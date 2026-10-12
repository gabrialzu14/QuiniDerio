export default function DataLoading(){
  return <div className="qdDataLoading" role="status">
    <span className="qdLoadingDot" aria-hidden="true"/>
    <span>Actualizando los datos de la jornada…</span>
    <span className="qdLoadingLine" aria-hidden="true"/>
  </div>;
}
