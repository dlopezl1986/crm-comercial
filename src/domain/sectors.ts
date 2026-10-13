/**
 * Sectores (grupos) y clasificación automática de subsectores.
 * El subsector es la categoría detallada (p. ej. "Empresa de transporte por camión");
 * el sector es el grupo al que pertenece (p. ej. "Transporte y logística").
 * Las reglas se aplican en orden: la primera que encaja decide.
 */
import { norm } from '@/lib/text';

export const SECTORS = [
  'Transporte y logística',
  'Industria y fabricación',
  'Construcción e instalaciones',
  'Automoción y talleres',
  'Alimentación y bebidas',
  'Distribución y mayoristas',
  'Comercio minorista',
  'Servicios legales',
  'Asesoría, finanzas y seguros',
  'Tecnología e informática',
  'Salud y bienestar',
  'Servicios a empresas',
  'Energía y medio ambiente',
  'Educación y sector público',
  'Otros',
] as const;
export type SectorName = (typeof SECTORS)[number];

const RULES: [SectorName, RegExp][] = [
  // Nombres genéricos de sector (cuando el origen ya trae un sector amplio)
  ['Industria y fabricación', /^industria|^fabricacion|^manufactura/],
  ['Salud y bienestar', /^salud|^sanidad|^farmacia|^farmaceutic/],
  ['Educación y sector público', /^educacion|^administracion publica|^sector publico|^ayuntamiento/],
  ['Alimentación y bebidas', /^hosteleria|^alimentacion|^restauracion$/],
  ['Distribución y mayoristas', /^distribucion$|^comercio mayorista/],
  ['Servicios a empresas', /^servicios profesionales|^servicios a empresas/],
  ['Asesoría, finanzas y seguros', /^seguros|^banca|^finanzas/],
  ['Energía y medio ambiente', /recicla|residuo|basura|carga de vehiculos electricos|energia solar|petroleo|gas natural|compania del gas|forestal|arboreo/],
  ['Distribución y mayoristas', /suministros industriales/],
  ['Transporte y logística', /transport|logistic|mensajer|mudanza|autobus|almacen\b|almacen$|ferroviari|distribucion$|traslado|paqueter/],
  ['Servicios legales', /abogad|advocat|bufete|notari|servicios legales|juridic|procurador/],
  ['Asesoría, finanzas y seguros', /asesor|gestoria|contabilidad|fiscal|banco|financier|seguro|asegurador|hipotecari|corredor|administracion de empresas|administrador de la propiedad|consultora de administracion/],
  ['Tecnología e informática', /informatic|software|sitios web|ordenador|telecomunicacion|tecnologia de eventos|componentes electronicos|tienda de electronica|toner|fotocopiadora|parque tecnologico|audiovisual/],
  ['Salud y bienestar', /clinic|medic|dental|dentist|odontolog|ortodonc|fisioterap|hospital|salud|veterinari|oftalmolog|dermatolog|psicolog|psiquiatr|osteopat|acupuntur|logoped|homeopat|cirujan|laboratorio de analisis|ginecolog|androlog|reproduccion asistida|trasplante capilar|dolor|diagnostico|alcoholismo|bienestar/],
  ['Automoción y talleres', /automovil|coche|vehiculo|motos?\b|escuter|autocaravana|concesionari|neumatic|chapa y pintura|taller mecanico|taller de automoviles|camion|remolque|embarcacion|maritim|velas para embarcaciones|bicicleta|cristales para automoviles|limpieza de automoviles|distribuidor de opel|carretillas/],
  ['Alimentación y bebidas', /aliment|comestible|bodega|vino|cerveza|carne|fruta|hortaliza|marisco|cafe|chocolat|confiteria|panader|congelad|conserva|condimento|supermercado|mercado de alimentos|productos del campo|semillas|restaurante|cafeter|hornear|tostador/],
  ['Distribución y mayoristas', /mayorista|distribuidor|distribuidores|proveedor|suministro|subministrament|importador|equipos para/],
  ['Servicios a empresas', /limpieza/],
  ['Industria y fabricación', /fabric|construccion de maquinaria/],
  ['Construcción e instalaciones', /construc|reforma|contratista|climatizacion|aire acondicionado|electricista|instalacion|fontaner|calderas|piscina|ventana|puertas|tejado|cubierta|albanil|mamposteria|azulejo|pavimento|suelos|pintura|carpinter|cerrajer|cristalero|arquitect|topografia|promotora inmobiliaria|ingenier|mantenimiento|canalones|mampara|madera/],
  ['Industria y fabricación', /manufact|industrial|metalurgi|moldeo|plastico|maquinaria|acero|hierro|siderurg|calderer|soldad|herrero|quimic|papel|imprenta|impresora|serigrafi|encuadern|embalaje|caucho|adhesiu|vigas|ceramica|textil|confeccion|edificios portatiles|acabados metalicos|optic|motores/],
  ['Servicios a empresas', /recursos humanos|trabajo temporal|contratacion|publicidad|disenador|grafico|produccion de video|copisteria|conserjeria|alquiler|oficinas de empresa|promocionales|pancartas|restauracion|reparacion|taller/],
  ['Educación y sector público', /universi|escuela|centro escolar|formacion|instituto de investigacion|biblioteca|departamento|gobierno|ayuntamiento|organizacion no gubernamental|ong\b|parada|puente|centro artistico|clases|estudi d.art|editor/],
  ['Comercio minorista', /tienda|ferreteria|joyeria|floristeria|florista|sombrereria|tapiceria|pelucas|cosmeticos|muebles|enmarcacion|surf|skate|monopatin|arreglos de ropa|piercing|deportes|instrumentos musicales/],
];

/** Sector para un subsector (categoría detallada). Sin coincidencia → "Otros". */
export function classifySector(subsector: string | undefined | null): SectorName {
  const s = norm(subsector).trim();
  if (!s) return 'Otros';
  for (const [sector, re] of RULES) if (re.test(s)) return sector;
  return 'Otros';
}

export const isSectorName = (v: string | undefined | null): v is SectorName => !!v && (SECTORS as readonly string[]).includes(v);

/**
 * Normaliza sector/subsector de una empresa:
 * - si "sector" no es uno de los grupos, en realidad es un subsector;
 * - el sector se deduce del subsector cuando falta.
 */
export function resolveSector(sector?: string | null, subsector?: string | null): { sector?: SectorName; subsector?: string } {
  const sub = subsector?.trim() || (!isSectorName(sector) ? sector?.trim() : undefined) || undefined;
  const sec = isSectorName(sector) ? sector : sub ? classifySector(sub) : undefined;
  return { sector: sec, subsector: sub };
}
