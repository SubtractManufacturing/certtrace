import type { OpenLibraryResult } from "@certtrace/library-engine";
import type { JobMetadataV1 } from "@certtrace/types";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addJob,
  deleteJob,
  fetchJobCustomers,
  fetchJobs,
  updateJobMetadata,
} from "../lib/library-client";
import { JobsWorkspace } from "./JobsWorkspace";

vi.mock("../lib/library-client", () => ({
  addJob: vi.fn(),
  deleteJob: vi.fn(),
  fetchJobCustomers: vi.fn(async () => []),
  fetchJobs: vi.fn(async () => []),
  updateJobMetadata: vi.fn(),
}));

const sampleLibrary = {
  paths: { root: "/tmp/shop", jobs: "/tmp/shop/jobs" },
  config: { name: "Main Shop" },
} as OpenLibraryResult;

const sampleJobs: JobMetadataV1[] = [
  {
    version: 3,
    id: "job_1",
    jobNumber: "JO-1001",
    jobDate: "2026-08-10",
    customer: "Acme Machining",
    notes: "Rush",
    createdAt: "2026-08-10T12:00:00.000Z",
    updatedAt: "2026-08-10T12:00:00.000Z",
  },
  {
    version: 3,
    id: "job_2",
    jobNumber: "JO-1002",
    jobDate: "2026-08-11",
    customer: "Beta Works",
    createdAt: "2026-08-11T12:00:00.000Z",
    updatedAt: "2026-08-11T12:00:00.000Z",
  },
];

describe("JobsWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchJobs).mockResolvedValue(sampleJobs);
    vi.mocked(fetchJobCustomers).mockResolvedValue(["Acme Machining", "Beta Works"]);
  });

  it("lists jobs for the open library and filters by customer", async () => {
    const user = userEvent.setup();
    const sessionLibraries = new Map([["/tmp/shop", sampleLibrary]]);

    render(
      <JobsWorkspace sessionLibraries={sessionLibraries} activeLibraryPath="/tmp/shop" />,
    );

    expect(await screen.findByText("JO-1001")).toBeTruthy();
    expect(screen.getByText("JO-1002")).toBeTruthy();
    expect(fetchJobs).toHaveBeenCalledWith(sampleLibrary);

    await user.type(screen.getByPlaceholderText("Find by customer…"), "acme");
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

    render(
      <JobsWorkspace sessionLibraries={sessionLibraries} activeLibraryPath="/tmp/shop" />,
    );
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

    render(
      <JobsWorkspace sessionLibraries={sessionLibraries} activeLibraryPath="/tmp/shop" />,
    );
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

  it("edits and deletes a job through the client", async () => {
    const user = userEvent.setup();
    const sessionLibraries = new Map([["/tmp/shop", sampleLibrary]]);
    vi.mocked(updateJobMetadata).mockResolvedValue({
      ...sampleJobs[0]!,
      customer: "Updated Co",
    });
    vi.mocked(deleteJob).mockResolvedValue(undefined);

    render(
      <JobsWorkspace sessionLibraries={sessionLibraries} activeLibraryPath="/tmp/shop" />,
    );
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

    const deleteButtons = screen.getAllByRole("button", { name: /^delete$/i });
    await user.click(deleteButtons[0]!);
    await user.click(screen.getByRole("button", { name: /delete job/i }));

    await waitFor(() => {
      expect(deleteJob).toHaveBeenCalledWith(sampleLibrary, "job_1");
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
