import { useEffect, useState } from "react";
import type { MaterialMetadataV1, RecentLibraryEntryV1 } from "@certtrace/types";
import type { OpenLibraryResult } from "@certtrace/library-engine";
import { Button, Input } from "@certtrace/ui";
import {
  addMaterial,
  createLibraryAtPath,
  fetchMaterials,
  openLibraryAtPath,
  pickParentFolder,
} from "../lib/library-client";
import { forgetRecentLibrary, loadAppSettings } from "../lib/app-settings-client";
import { onLibraryFsChanged, startLibraryWatch, stopLibraryWatch } from "../lib/library-watch";

interface MaterialsViewProps {
  library: OpenLibraryResult;
  libraryRoot: string;
  onCloseLibrary: () => void;
}

export function MaterialsView({ library, libraryRoot, onCloseLibrary }: MaterialsViewProps) {
  const [materials, setMaterials] = useState<MaterialMetadataV1[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [materialCode, setMaterialCode] = useState("AL");
  const [material, setMaterial] = useState("");
  const [supplier, setSupplier] = useState("");
  const [heat, setHeat] = useState("");
  const [location, setLocation] = useState("");

  async function refreshMaterials(currentLibrary: OpenLibraryResult) {
    setLoading(true);
    setError(null);
    try {
      setMaterials(await fetchMaterials(currentLibrary));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshMaterials(library);
  }, [library, libraryRoot]);

  useEffect(() => {
    void startLibraryWatch(libraryRoot);

    let unlisten: (() => void) | undefined;
    void onLibraryFsChanged(() => {
      void refreshMaterials(library);
    }).then((dispose) => {
      unlisten = dispose;
    });

    return () => {
      unlisten?.();
      void stopLibraryWatch();
    };
  }, [library, libraryRoot]);

  async function handleAddMaterial(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await addMaterial(library, {
        materialCode,
        material,
        supplier,
        heat,
        location,
      });
      setMaterial("");
      setSupplier("");
      setHeat("");
      setLocation("");
      await refreshMaterials(library);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {library.config.name}
            </p>
            <p className="mt-1 truncate text-sm text-slate-600">{libraryRoot}</p>
          </div>
          <Button type="button" variant="outline" onClick={onCloseLibrary}>
            Change library
          </Button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-6">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Add material</h2>
          <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={handleAddMaterial}>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">ID prefix / material code</span>
              <Input
                value={materialCode}
                onChange={(event) => setMaterialCode(event.target.value)}
                placeholder="AL"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">Material</span>
              <Input
                value={material}
                onChange={(event) => setMaterial(event.target.value)}
                placeholder="6061-T6"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">Supplier</span>
              <Input value={supplier} onChange={(event) => setSupplier(event.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-slate-700">Heat</span>
              <Input value={heat} onChange={(event) => setHeat(event.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="font-medium text-slate-700">Location</span>
              <Input
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="Rack B2"
              />
            </label>
            <div className="sm:col-span-2">
              <Button type="submit">Add material</Button>
            </div>
          </form>
        </section>

        {error ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-semibold">Materials</h2>
          </div>
          {loading ? (
            <p className="px-5 py-8 text-sm text-slate-500">Loading materials…</p>
          ) : materials.length === 0 ? (
            <p className="px-5 py-8 text-sm text-slate-500">No materials yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-5 py-3 font-medium">ID</th>
                    <th className="px-5 py-3 font-medium">Material</th>
                    <th className="px-5 py-3 font-medium">Supplier</th>
                    <th className="px-5 py-3 font-medium">Heat</th>
                    <th className="px-5 py-3 font-medium">Location</th>
                  </tr>
                </thead>
                <tbody>
                  {materials.map((entry) => (
                    <tr key={entry.id} className="border-t border-slate-100">
                      <td className="px-5 py-3 font-medium">{entry.id}</td>
                      <td className="px-5 py-3">{entry.material || "—"}</td>
                      <td className="px-5 py-3">{entry.supplier || "—"}</td>
                      <td className="px-5 py-3">{entry.heat || "—"}</td>
                      <td className="px-5 py-3">{entry.location || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

interface WelcomeViewProps {
  onLibraryReady: (root: string, library: OpenLibraryResult) => void;
}

export function WelcomeView({ onLibraryReady }: WelcomeViewProps) {
  const [libraryName, setLibraryName] = useState("Main Shop Materials");
  const [recentLibraries, setRecentLibraries] = useState<RecentLibraryEntryV1[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void loadAppSettings()
      .then((settings) => setRecentLibraries(settings.recentLibraries))
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
      });
  }, []);

  async function openRecent(entry: RecentLibraryEntryV1) {
    setBusy(true);
    setError(null);
    try {
      const library = await openLibraryAtPath(entry.path);
      onLibraryReady(entry.path, library);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveRecent(path: string) {
    try {
      const settings = await forgetRecentLibrary(path);
      setRecentLibraries(settings.recentLibraries);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleOpenLibrary() {
    setBusy(true);
    setError(null);
    try {
      const root = await pickParentFolder("Open CertTrace library folder");
      if (!root) {
        return;
      }
      const library = await openLibraryAtPath(root);
      setRecentLibraries((await loadAppSettings()).recentLibraries);
      onLibraryReady(root, library);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateLibrary() {
    setBusy(true);
    setError(null);
    try {
      const name = libraryName.trim();
      if (!name) {
        setError("Enter a library name.");
        return;
      }

      const parentDir = await pickParentFolder("Choose where to create the library");
      if (!parentDir) {
        return;
      }
      const library = await createLibraryAtPath(parentDir, name);
      setRecentLibraries((await loadAppSettings()).recentLibraries);
      onLibraryReady(library.paths.root, library);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 text-slate-900">
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Subtract Manufacturing
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">CertTrace</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Open an existing library folder, or create a new one in the location you choose.
          CertTrace creates a folder named after your library and writes a README inside.
        </p>

        <label className="mt-6 flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">Library name</span>
          <Input value={libraryName} onChange={(event) => setLibraryName(event.target.value)} />
        </label>

        {recentLibraries.length > 0 ? (
          <section className="mt-6">
            <h2 className="text-sm font-semibold text-slate-700">Recent libraries</h2>
            <ul className="mt-2 divide-y divide-slate-100 rounded-md border border-slate-200">
              {recentLibraries.map((entry) => (
                <li
                  key={entry.path}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                >
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void openRecent(entry)}
                    className="min-w-0 flex-1 text-left hover:text-slate-900 disabled:opacity-50"
                  >
                    <span className="block truncate font-medium">{entry.name}</span>
                    <span className="block truncate text-xs text-slate-500">{entry.path}</span>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => void handleRemoveRecent(entry.path)}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            className="flex-1"
            onClick={() => void handleOpenLibrary()}
          >
            Open library
          </Button>
          <Button
            type="button"
            disabled={busy}
            className="flex-1"
            onClick={() => void handleCreateLibrary()}
          >
            Create library
          </Button>
        </div>

        {error ? (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}
      </div>
    </main>
  );
}
