import { useState } from "react";
import type { OpenLibraryResult } from "@certtrace/library-engine";
import { MaterialsView, WelcomeView } from "./components/LibraryViews";

function App() {
  const [libraryRoot, setLibraryRoot] = useState<string | null>(null);
  const [library, setLibrary] = useState<OpenLibraryResult | null>(null);

  if (library && libraryRoot) {
    return (
      <MaterialsView
        library={library}
        libraryRoot={libraryRoot}
        onCloseLibrary={() => {
          setLibrary(null);
          setLibraryRoot(null);
        }}
      />
    );
  }

  return (
    <WelcomeView
      onLibraryReady={(root, opened) => {
        setLibraryRoot(root);
        setLibrary(opened);
      }}
    />
  );
}

export default App;
