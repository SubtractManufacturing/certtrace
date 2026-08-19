import type { OpenLibraryResult } from "@certtrace/library-engine";
import type { JobMetadataV1, MaterialMetadataV1 } from "@certtrace/types";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addJob,
  assignMaterialToJob,
  deleteJob,
  fetchAssignedMaterialIds,
  fetchJobCustomers,
  fetchJobs,
  fetchMaterials,
  fetchMaterialsForJob,
  unassignMaterialFromJob,
  updateJobMetadata,
} from "../lib/library-client";
import { chooseSelectOption } from "../test/select-helpers";
import { JobsWorkspace } from "./JobsWorkspace";

vi.mock("../lib/library-client", () => ({
  addJob: vi.fn(),
  assignMaterialToJob: vi.fn(),
  deleteJob: vi.fn(),
  fetchAssignedMaterialIds: vi.fn(async () => []),
  fetchJobCustomers: vi.fn(async () => []),
  fetchJobs: vi.fn(async () => []),
  fetchMaterials: vi.fn(async () => []),
  fetchMaterialsForJob: vi.fn(async () => []),
  unassignMaterialFromJob: vi.fn(),
  updateJobMetadata: vi.fn(),
}));

const sampleLibrary = {
  paths: { root: "/tmp/shop", jobs: "/tmp/shop/jobs" },
  config: { name: "Main Shop" },
} as OpenLibraryResult;

const sampleJobs: JobMetadataV1[] = [
  {
    version: 4,
    id: "job_1",
    jobNumber: "JO-1001",
    jobDate: "2026-08-10",
    customer: "Acme Machining",
    notes: "Rush",
    createdAt: "2026-08-10T12:00:00.000Z",
    updatedAt: "2026-08-10T12:00:00.000Z",
  },
  {
    version: 4,
    id: "job_2",
    jobNumber: "JO-1002",
    jobDate: "2026-08-11",
    customer: "Beta Works",
    createdAt: "2026-08-11T12:00:00.000Z",
    updatedAt: "2026-08-11T12:00:00.000Z",
  },
];

const sampleMaterials: MaterialMetadataV1[] = [
  {
    version: 4,
    id: "AL-100",
    fields: {},
    identifiers: {},
    archived: false,
    createdAt: "2026-08-10T12:00:00.000Z",
    updatedAt: "2026-08-10T12:00:00.000Z",
  },
  {
    version: 4,
    id: "ST-200",
    fields: {},
    identifiers: {},
    archived: true,
    createdAt: "2026-08-10T12:00:00.000Z",
    updatedAt: "2026-08-10T12:00:00.000Z",
  },
];

describe("JobsWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchJobs).mockResolvedValue(sampleJobs);
    vi.mocked(fetchJobCustomers).mockResolvedValue(["Acme Machining", "Beta Works"]);
    vi.mocked(fetchMaterials).mockResolvedValue(sampleMaterials);
    vi.mocked(fetchMaterialsForJob).mockResolvedValue([]);
    vi.mocked(fetchAssignedMaterialIds).mockImplementation(async (_library, jobId) => {
      if (jobId === "job_1") {
        return ["AL-100", "ST-200", "TI-300"];
      }
      return [];
    });
  });

  it("lists jobs for the open library and searches across job fields", async () => {
    const user = userEvent.setup();
    const sessionLibraries = new Map([["/tmp/shop", sampleLibrary]]);

    render(<JobsWorkspace sessionLibraries={sessionLibraries} activeLibraryPath="/tmp/shop" />);

    expect(await screen.findByText("JO-1001")).toBeTruthy();
    expect(screen.getByText("JO-1002")).toBeTruthy();
    expect(fetchJobs).toHaveBeenCalledWith(sampleLibrary);
    expect(screen.getByText("AL-100")).toBeTruthy();
    expect(screen.getByText("ST-200")).toBeTruthy();
    expect(screen.getByText("…")).toBeTruthy();
    expect(screen.queryByText("Notes")).toBeNull();
    expect(screen.queryByText("Actions")).toBeNull();

    await user.type(screen.getByPlaceholderText("Search Jobs..."), "acme");
    expect(screen.getByText("JO-1001")).toBeTruthy();
    expect(screen.queryByText("JO-1002")).toBeNull();
  });

  it("creates a job with required fields and empty job date by default", async () => {
    const user = userEvent.setup();
    const sessionLibraries = new Map([["/tmp/shop", sampleLibrary]]);
    vi.mocked(addJob).mockResolvedValue({
      ...sampleJobs[0]!,
      id: "job_3",
      jobNumber: "JO-2000",
    });

    render(<JobsWorkspace sessionLibraries={sessionLibraries} activeLibraryPath="/tmp/shop" />);
    await screen.findByText("JO-1001");

    await user.click(screen.getByRole("button", { name: /add job/i }));
    const dialog = screen.getByRole("dialog");
    const dateInput = within(dialog).getByLabelText("Job date") as HTMLInputElement;
    expect(dateInput.value).toBe("");
    expect(fetchJobCustomers).toHaveBeenCalledWith(sampleLibrary);
    const suggestions = document.getElementById("job-customer-suggestions");
    expect(suggestions).toBeTruthy();
    const optionValues = [...(suggestions as HTMLDataListElement).options].map(
      (option) => option.value,
    );
    expect(optionValues).toEqual(["Acme Machining", "Beta Works"]);

    await user.type(within(dialog).getByLabelText("Job number"), "JO-2000");
    await user.clear(dateInput);
    await user.type(dateInput, "2026-08-12");
    await user.type(within(dialog).getByLabelText("Customer"), "Acme Machining");
    await user.click(within(dialog).getByRole("button", { name: /^add job$/i }));

    await waitFor(() => {
      expect(addJob).toHaveBeenCalledWith(sampleLibrary, {
        jobNumber: "JO-2000",
        jobDate: "2026-08-12",
        customer: "Acme Machining",
        notes: "",
      });
    });
  });

  it("surfaces duplicate job number errors from the client", async () => {
    const user = userEvent.setup();
    const sessionLibraries = new Map([["/tmp/shop", sampleLibrary]]);
    vi.mocked(addJob).mockRejectedValue(
      new Error('A Job with number "JO-1001" already exists in this library.'),
    );

    render(<JobsWorkspace sessionLibraries={sessionLibraries} activeLibraryPath="/tmp/shop" />);
    await screen.findByText("JO-1001");

    await user.click(screen.getByRole("button", { name: /add job/i }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("Job number"), "JO-1001");
    const dateInput = within(dialog).getByLabelText("Job date");
    await user.type(dateInput, "2026-08-12");
    await user.click(within(dialog).getByRole("button", { name: /^add job$/i }));

    expect(
      await screen.findByText('A Job with number "JO-1001" already exists in this library.'),
    ).toBeTruthy();
  });

  it("edits and deletes a job from the detail modal", async () => {
    const user = userEvent.setup();
    const sessionLibraries = new Map([["/tmp/shop", sampleLibrary]]);
    vi.mocked(updateJobMetadata).mockResolvedValue({
      ...sampleJobs[0]!,
      customer: "Updated Co",
    });
    vi.mocked(deleteJob).mockResolvedValue(undefined);
    vi.mocked(fetchMaterialsForJob).mockResolvedValue([sampleMaterials[0]!]);
    vi.mocked(fetchAssignedMaterialIds).mockResolvedValue([sampleMaterials[0]!.id]);

    render(<JobsWorkspace sessionLibraries={sessionLibraries} activeLibraryPath="/tmp/shop" />);
    await screen.findByText("JO-1001");

    await user.click(screen.getByText("JO-1001"));
    const editDialog = screen.getByRole("dialog");
    const customerInput = within(editDialog).getByLabelText("Customer");
    await user.clear(customerInput);
    await user.type(customerInput, "Updated Co");
    await user.click(within(editDialog).getByRole("button", { name: /save job/i }));

    await waitFor(() => {
      expect(updateJobMetadata).toHaveBeenCalledWith(sampleLibrary, "job_1", {
        jobNumber: "JO-1001",
        jobDate: "2026-08-10",
        customer: "Updated Co",
        notes: "Rush",
      });
    });

    await user.click(await screen.findByText("JO-1001"));
    const reopenDialog = screen.getByRole("dialog");
    await user.click(within(reopenDialog).getByLabelText("Delete job"));
    expect(await screen.findByRole("heading", { name: /delete job jo-1001/i })).toBeTruthy();
    expect(screen.getByText(/1 Job assignment/i)).toBeTruthy();
    const confirmButtons = screen.getAllByRole("button", { name: /^delete job$/i });
    await user.click(confirmButtons[confirmButtons.length - 1]!);

    await waitFor(() => {
      expect(deleteJob).toHaveBeenCalledWith(sampleLibrary, "job_1");
    });
  });

  it("assigns and unassigns materials from a job with unlink confirmation", async () => {
    const user = userEvent.setup();
    const sessionLibraries = new Map([["/tmp/shop", sampleLibrary]]);
    vi.mocked(fetchMaterialsForJob)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([sampleMaterials[1]!])
      .mockResolvedValueOnce([]);
    vi.mocked(assignMaterialToJob).mockResolvedValue(undefined);
    vi.mocked(unassignMaterialFromJob).mockResolvedValue(undefined);

    render(<JobsWorkspace sessionLibraries={sessionLibraries} activeLibraryPath="/tmp/shop" />);
    await screen.findByText("JO-1001");
    await user.click(screen.getByText("JO-1001"));

    const editDialog = await screen.findByRole("dialog");
    const assignSelect = await waitFor(() => {
      const combobox = within(editDialog).getByLabelText("Assign material");
      expect(combobox.getAttribute("data-value")).toBe("");
      expect((combobox as HTMLButtonElement).disabled).toBe(false);
      return combobox;
    });

    await chooseSelectOption(assignSelect, /ST-200/);
    await user.click(within(editDialog).getByRole("button", { name: /^assign$/i }));

    await waitFor(() => {
      expect(assignMaterialToJob).toHaveBeenCalledWith(sampleLibrary, "job_1", "ST-200");
    });
    expect(await within(editDialog).findByText(/ST-200/)).toBeTruthy();

    await user.click(within(editDialog).getByRole("button", { name: /^unlink$/i }));
    expect(screen.getByRole("heading", { name: /unlink material from job/i })).toBeTruthy();
    const unlinkButtons = screen.getAllByRole("button", { name: /^unlink$/i });
    await user.click(unlinkButtons[unlinkButtons.length - 1]!);

    await waitFor(() => {
      expect(unassignMaterialFromJob).toHaveBeenCalledWith(sampleLibrary, "job_1", "ST-200");
    });
  });

  it("requires a single library before managing jobs", async () => {
    render(
      <JobsWorkspace
        sessionLibraries={new Map([["/tmp/shop", sampleLibrary]])}
        activeLibraryPath="all"
      />,
    );

    expect(screen.getByText(/select a single library/i)).toBeTruthy();
    expect((screen.getByRole("button", { name: /add job/i }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(fetchJobs).not.toHaveBeenCalled();
  });
});
