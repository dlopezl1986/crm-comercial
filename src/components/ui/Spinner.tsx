export function Spinner({ size = 20 }: { size?: number }) {
  return <span className="spinner" style={{ width: size, height: size }} aria-label="Cargando" />;
}

export function FullScreenLoader() {
  return (
    <div className="center-screen">
      <Spinner size={32} />
    </div>
  );
}
