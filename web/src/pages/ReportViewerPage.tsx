import { useEffect } from 'react';
import { useParams } from 'react-router';

// Placeholder — built out in step 3.7.
export function ReportViewerPage() {
  const { reportId } = useParams();
  const appName = import.meta.env.VITE_APP_NAME;

  useEffect(() => {
    document.title = `Report · ${appName}`;
  }, [appName]);

  return <h1 className="text-2xl font-bold">Report: {reportId}</h1>;
}
