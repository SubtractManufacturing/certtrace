export function createLibraryReadme(libraryName: string): string {
  return `# ${libraryName}

This folder is a **CertTrace material library**.

CertTrace stores material certifications, metadata, and labels here. The app keeps data in human-readable JSON alongside your PDF and image files.

## Folder layout

\`\`\`txt
${libraryName}/
  README.md           ← this file
  .certtrace/         ← library settings (do not delete)
  materials/          ← one folder per material with certs attached
  jobs/               ← one folder per Job (metadata + optional assignments.json)
\`\`\`

## Notes

- Safe to copy or sync via Google Drive, OneDrive, Dropbox, or a network share
- Open this folder in CertTrace to manage materials and jobs
- No cloud account required — everything stays on your disk

[CertTrace on GitHub](https://github.com/SubtractManufacturing/certtrace)
`;
}
