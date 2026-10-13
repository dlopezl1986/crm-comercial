import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { DataProvider, useData } from '@/data/DataProvider';
import { FullScreenLoader } from '@/components/ui/Spinner';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

function SyncError() {
  const { error } = useData();
  return error ? <div className="alert alert--error sync-error">{error} Revisa tu conexión y recarga la página.</div> : null;
}

export function AppLayout() {
  return (
    <DataProvider>
      <div className="shell">
        <Sidebar />
        <div className="shell__main">
          <Topbar />
          <main className="content">
            <SyncError />
            <Suspense fallback={<FullScreenLoader />}><Outlet /></Suspense>
          </main>
        </div>
      </div>
    </DataProvider>
  );
}
