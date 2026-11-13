#!/usr/bin/env bash
# Prueba de humo de SIGMVE contra la API corriendo (requiere curl y node).
# Uso:  bash scripts/smoke-test.sh            (todos los módulos)
#       bash scripts/smoke-test.sh 1          (solo Módulo 1; también 2, 3, 4 o 5)
# Nota: el login está limitado a THROTTLE_LOGIN_LIMIT intentos/minuto por IP. Si repites la
# prueba varias veces seguidas y ves HTTP 429, espera un minuto o sube el límite en .env.
API="${API:-http://localhost:3000/api}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@sigmve.cl}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin1234}"
ONLY="${1:-all}"
ok=0; fail=0
check() { # descripcion esperado obtenido
  if [ "$2" = "$3" ]; then echo "  [OK]    $1 ($3)"; ok=$((ok+1)); else echo "  [FALLA] $1 (esperado $2, obtenido $3)"; fail=$((fail+1)); fi
}
code() { curl -s -o /dev/null -w "%{http_code}" "$@"; }
J='Content-Type: application/json'
# jget campo.subcampo  -> lee JSON por stdin y devuelve el valor (vacío si no existe)
jget() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{let o=JSON.parse(s);for(const k of process.argv[1].split("."))o=o?.[k];console.log(o??"")}catch{console.log("")}})' "$1"; }
login() { curl -s -X POST "$API/auth/login" -H "$J" -d "{\"email\":\"$1\",\"password\":\"$2\"}" | jget accessToken; }
vstatus() { curl -s "$API/vehicles/$1" -H "$AUTH" | jget status; }
run() { [ "$ONLY" = all ] || [ "$ONLY" = "$1" ]; }

STAMP=$(date +%s)
# Patente única por ejecución (formato ABCD-12)
L=ABCDEFGHJKLPRSTVWXYZ
# Letras derivadas del timestamp (cambian cada segundo, se repiten recién en ~44 h) y número = índice del vehículo.
# Antes el índice se sumaba al timestamp y dos ejecuciones separadas por pocos segundos podían repetir patente.
plate() { printf "%s%s%s%s-%02d" "${L:$((STAMP%20)):1}" "${L:$((STAMP/20%20)):1}" "${L:$((STAMP/400%20)):1}" "${L:$((STAMP/8000%20)):1}" "$1"; }

TOKEN=$(login "$ADMIN_EMAIL" "$ADMIN_PASSWORD")
AUTH="Authorization: Bearer $TOKEN"

# ───────────────────────────────────────────────────────────────────────────────
if run 1; then
echo "== Módulo 1: usuarios y autenticación =="
check "Health check" 200 "$(code "$API/health")"
check "Login con clave incorrecta es rechazado" 401 "$(code -X POST "$API/auth/login" -H "$J" -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"incorrecta1\"}")"
check "Ruta protegida sin token es rechazada" 401 "$(code "$API/auth/me")"
if [ -n "$TOKEN" ]; then check "Login de administrador entrega token" si si; else check "Login de administrador entrega token" si no; fi
check "GET /auth/me con token" 200 "$(code "$API/auth/me" -H "$AUTH")"
check "/auth/me no expone el hash de la contraseña" "" "$(curl -s "$API/auth/me" -H "$AUTH" | jget passwordHash)"

VEMAIL="viewer$STAMP@sigmve.cl"
check "Admin registra un usuario viewer" 201 "$(code -X POST "$API/auth/register" -H "$AUTH" -H "$J" -d "{\"email\":\"$VEMAIL\",\"password\":\"Clave123\",\"fullName\":\"Usuario Consulta\",\"role\":\"viewer\"}")"
check "Correo duplicado es rechazado (aunque venga en mayúsculas)" 409 "$(code -X POST "$API/auth/register" -H "$AUTH" -H "$J" -d "{\"email\":\"VIEWER$STAMP@SIGMVE.CL\",\"password\":\"Clave123\",\"fullName\":\"Usuario Consulta\",\"role\":\"viewer\"}")"
check "Datos inválidos son rechazados (validación)" 400 "$(code -X POST "$API/auth/register" -H "$AUTH" -H "$J" -d '{"email":"no-es-correo","password":"1","fullName":"x","role":"jefe"}')"
check "Contraseña débil es rechazada" 400 "$(code -X POST "$API/auth/register" -H "$AUTH" -H "$J" -d "{\"email\":\"debil$STAMP@sigmve.cl\",\"password\":\"12345678\",\"fullName\":\"Clave Debil\",\"role\":\"viewer\"}")"
check "Campo no permitido en el body es rechazado" 400 "$(code -X POST "$API/auth/register" -H "$AUTH" -H "$J" -d "{\"email\":\"extra$STAMP@sigmve.cl\",\"password\":\"Clave123\",\"fullName\":\"Campo Extra\",\"role\":\"viewer\",\"isAdmin\":true}")"

VTOKEN=$(login "VIEWER$STAMP@SIGMVE.cl" "Clave123")
if [ -n "$VTOKEN" ]; then check "Login no distingue mayúsculas en el correo" si si; else check "Login no distingue mayúsculas en el correo" si no; fi
check "Rol viewer NO puede registrar usuarios" 403 "$(code -X POST "$API/auth/register" -H "Authorization: Bearer $VTOKEN" -H "$J" -d '{"email":"otro@sigmve.cl","password":"Clave123","fullName":"Otro Usuario","role":"viewer"}')"
check "Rol viewer NO puede listar usuarios" 403 "$(code "$API/users" -H "Authorization: Bearer $VTOKEN")"
check "Admin lista usuarios" 200 "$(code "$API/users" -H "$AUTH")"
check "Cambio de clave con clave actual incorrecta" 401 "$(code -X PATCH "$API/auth/password" -H "Authorization: Bearer $VTOKEN" -H "$J" -d '{"currentPassword":"Mala1234","newPassword":"Nueva1234"}')"
check "Usuario cambia su propia clave" 200 "$(code -X PATCH "$API/auth/password" -H "Authorization: Bearer $VTOKEN" -H "$J" -d '{"currentPassword":"Clave123","newPassword":"Nueva1234"}')"

ME_ID=$(curl -s "$API/auth/me" -H "$AUTH" | jget id)
VID=$(curl -s "$API/auth/me" -H "Authorization: Bearer $VTOKEN" | jget id)
check "Admin no puede desactivarse a sí mismo" 400 "$(code -X PATCH "$API/users/$ME_ID" -H "$AUTH" -H "$J" -d '{"active":false}')"
check "Admin desactiva al usuario viewer" 200 "$(code -X PATCH "$API/users/$VID" -H "$AUTH" -H "$J" -d '{"active":false}')"
check "El token del usuario desactivado deja de servir" 401 "$(code "$API/auth/me" -H "Authorization: Bearer $VTOKEN")"
check "Usuario desactivado no puede iniciar sesión" 401 "$(code -X POST "$API/auth/login" -H "$J" -d "{\"email\":\"$VEMAIL\",\"password\":\"Nueva1234\"}")"
fi

# Operador para los módulos siguientes
OEMAIL="operador$STAMP@sigmve.cl"
curl -s -o /dev/null -X POST "$API/auth/register" -H "$AUTH" -H "$J" -d "{\"email\":\"$OEMAIL\",\"password\":\"Clave123\",\"fullName\":\"Operador Prueba\",\"role\":\"operator\"}"
OTOKEN=$(login "$OEMAIL" "Clave123"); OP="Authorization: Bearer $OTOKEN"

# ───────────────────────────────────────────────────────────────────────────────
if run 2 || run 3 || run 4 || run 5; then
P1=$(plate 1); P2=$(plate 2)
V1=$(curl -s -X POST "$API/vehicles" -H "$OP" -H "$J" -d "{\"plate\":\"$P1\",\"type\":\"bomba\",\"brand\":\"Mercedes-Benz\",\"model\":\"Atego\",\"year\":2018,\"station\":\"Primera Compañía\",\"mileage\":42000}" | jget id)
V2=$(curl -s -X POST "$API/vehicles" -H "$OP" -H "$J" -d "{\"plate\":\"$P2\",\"type\":\"ambulancia\",\"brand\":\"Ford\",\"model\":\"Transit\",\"year\":2021}" | jget id)
fi

if run 2; then
echo "== Módulo 2: vehículos =="
if [ -n "$V1" ] && [ -n "$V2" ]; then check "Operador registra vehículos" si si; else check "Operador registra vehículos" si no; fi
check "Patente duplicada es rechazada" 409 "$(code -X POST "$API/vehicles" -H "$OP" -H "$J" -d "{\"plate\":\"$(echo "$P1" | tr 'A-Z' 'a-z')\",\"type\":\"bomba\",\"brand\":\"X\",\"model\":\"Y\",\"year\":2018}")"
check "Patente con formato inválido es rechazada" 400 "$(code -X POST "$API/vehicles" -H "$OP" -H "$J" -d '{"plate":"123","type":"bomba","brand":"X","model":"Y","year":2018}')"
check "Filtro ?status inválido responde 400 (antes 500)" 400 "$(code "$API/vehicles?status=xx" -H "$AUTH")"
check "Filtro por búsqueda de patente" "$P1" "$(curl -s "$API/vehicles?search=$P1" -H "$AUTH" | jget 0.plate)"
check "Cambiar a patente ya usada responde 409 (antes 500)" 409 "$(code -X PATCH "$API/vehicles/$V1" -H "$OP" -H "$J" -d "{\"plate\":\"$P2\"}")"
check "en_mantencion no se asigna a mano" 400 "$(code -X PATCH "$API/vehicles/$V1" -H "$OP" -H "$J" -d '{"status":"en_mantencion"}')"
check "El kilometraje no puede disminuir" 400 "$(code -X PATCH "$API/vehicles/$V1" -H "$OP" -H "$J" -d '{"mileage":100}')"
check "Operador NO puede eliminar vehículos" 403 "$(code -X DELETE "$API/vehicles/$V2" -H "$OP")"
check "Resumen de disponibilidad" 200 "$(code "$API/vehicles/summary" -H "$AUTH")"
fi

# ───────────────────────────────────────────────────────────────────────────────
if run 3; then
echo "== Módulo 3: mantenciones =="
newm() { curl -s -X POST "$API/maintenances" -H "$OP" -H "$J" -d "{\"vehicleId\":\"$1\",\"type\":\"$2\",\"description\":\"$3\",\"scheduledDate\":\"2026-10-01\",\"status\":\"$4\",\"cost\":$5}" | jget id; }
check "Filtro ?vehicleId inválido responde 400 (antes 500)" 400 "$(code "$API/maintenances?vehicleId=abc" -H "$AUTH")"
MA=$(newm "$V2" preventiva "Cambio de aceite" en_proceso 85000)
MB=$(newm "$V2" correctiva "Cambio de neumaticos" en_proceso 240000)
check "Mantención en proceso deja el vehículo en_mantencion" en_mantencion "$(vstatus "$V2")"
curl -s -o /dev/null -X PATCH "$API/maintenances/$MA" -H "$OP" -H "$J" -d '{"status":"completada"}'
check "Con otra mantención aún en proceso, sigue en_mantencion (antes quedaba disponible)" en_mantencion "$(vstatus "$V2")"
curl -s -o /dev/null -X PATCH "$API/maintenances/$MB" -H "$OP" -H "$J" -d '{"status":"completada"}'
check "Al completar la última, vuelve a disponible" disponible "$(vstatus "$V2")"
check "Completada -> programada no está permitido (antes 200)" 409 "$(code -X PATCH "$API/maintenances/$MA" -H "$OP" -H "$J" -d '{"status":"programada"}')"
check "En una completada se puede corregir el costo" 200 "$(code -X PATCH "$API/maintenances/$MA" -H "$OP" -H "$J" -d '{"cost":90000}')"
check "No se puede marcar disponible un vehículo en el taller" 409 "$(MC=$(newm "$V2" preventiva "Revision frenos" en_proceso 0); code -X PATCH "$API/vehicles/$V2" -H "$OP" -H "$J" -d '{"status":"disponible"}'; curl -s -o /dev/null -X PATCH "$API/maintenances/$MC" -H "$OP" -H "$J" -d '{"status":"cancelada"}')"
check "Costos por vehículo" 200 "$(code "$API/maintenances/costs" -H "$AUTH")"
fi

# ───────────────────────────────────────────────────────────────────────────────
if run 4; then
echo "== Módulo 4: incidencias =="
curl -s -o /dev/null -X POST "$API/auth/register" -H "$AUTH" -H "$J" -d "{\"email\":\"consulta$STAMP@sigmve.cl\",\"password\":\"Clave123\",\"fullName\":\"Usuario Consulta\",\"role\":\"viewer\"}"
CTOKEN=$(login "consulta$STAMP@sigmve.cl" "Clave123")
check "Rol viewer NO puede reportar incidencias" 403 "$(code -X POST "$API/incidents" -H "Authorization: Bearer $CTOKEN" -H "$J" -d "{\"vehicleId\":\"$V1\",\"title\":\"Prueba viewer\",\"description\":\"No deberia poder crearla\",\"severity\":\"baja\"}")"
check "Rol viewer SÍ puede consultar incidencias" 200 "$(code "$API/incidents" -H "Authorization: Bearer $CTOKEN")"
I1=$(curl -s -X POST "$API/incidents" -H "$OP" -H "$J" -d "{\"vehicleId\":\"$V1\",\"title\":\"Falla en bomba de agua\",\"description\":\"La bomba no alcanza presion sobre 8 bar\",\"severity\":\"critica\",\"mileage\":42350}" | jget id)
if [ -n "$I1" ]; then check "Operador reporta incidencia crítica" si si; else check "Operador reporta incidencia crítica" si no; fi
check "Incidencia crítica deja el vehículo fuera_de_servicio" fuera_de_servicio "$(vstatus "$V1")"
check "El kilometraje reportado actualiza el vehículo" 42350 "$(curl -s "$API/vehicles/$V1" -H "$AUTH" | jget mileage)"
check "Queda registrado quién la reportó" "$OEMAIL" "$(curl -s "$API/incidents/$I1" -H "$AUTH" | jget reportedBy.email)"
check "No se puede marcar disponible con incidencia crítica abierta" 409 "$(code -X PATCH "$API/vehicles/$V1" -H "$OP" -H "$J" -d '{"status":"disponible"}')"
check "Resolver sin indicar resolución es rechazado" 400 "$(code -X PATCH "$API/incidents/$I1/status" -H "$OP" -H "$J" -d '{"status":"resuelta"}')"
MI=$(curl -s -X POST "$API/incidents/$I1/maintenance" -H "$OP" -H "$J" -d '{"scheduledDate":"2026-10-10"}' | jget maintenance.id)
check "Generar mantención correctiva deja la incidencia en_atencion" en_atencion "$(curl -s "$API/incidents/$I1" -H "$AUTH" | jget status)"
check "No se genera una segunda mantención para la misma incidencia" 409 "$(code -X POST "$API/incidents/$I1/maintenance" -H "$OP" -H "$J" -d '{"scheduledDate":"2026-10-10"}')"
curl -s -o /dev/null -X PATCH "$API/maintenances/$MI" -H "$OP" -H "$J" -d '{"status":"en_proceso"}'
check "Mantención en curso: vehículo en_mantencion" en_mantencion "$(vstatus "$V1")"
curl -s -o /dev/null -X PATCH "$API/maintenances/$MI" -H "$OP" -H "$J" -d '{"status":"completada","cost":150000}'
check "Al completar la mantención, la incidencia queda resuelta" resuelta "$(curl -s "$API/incidents/$I1" -H "$AUTH" | jget status)"
check "...y el vehículo vuelve a disponible" disponible "$(vstatus "$V1")"
check "Una incidencia resuelta no se reabre" 409 "$(code -X PATCH "$API/incidents/$I1/status" -H "$OP" -H "$J" -d '{"status":"abierta"}')"
I2=$(curl -s -X POST "$API/incidents" -H "$OP" -H "$J" -d "{\"vehicleId\":\"$V1\",\"title\":\"Luz de baliza intermitente\",\"description\":\"La baliza delantera falla de forma intermitente\",\"severity\":\"baja\"}" | jget id)
check "Incidencia leve no cambia la disponibilidad" disponible "$(vstatus "$V1")"
check "Descartar con resolución" 200 "$(code -X PATCH "$API/incidents/$I2/status" -H "$OP" -H "$J" -d '{"status":"descartada","resolution":"Era un conector suelto, se ajusto en el cuartel"}')"
check "Listado de incidencias abiertas" 200 "$(code "$API/incidents?open=true" -H "$AUTH")"
check "Resumen de incidencias (dashboard)" 200 "$(code "$API/incidents/summary" -H "$AUTH")"
check "No se elimina un vehículo con historial" 409 "$(code -X DELETE "$API/vehicles/$V1" -H "$AUTH")"
fi

# ───────────────────────────────────────────────────────────────────────────────
if run 5; then
echo "== Módulo 5: alertas =="
d() { node -e 'const t=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Santiago"}).format(new Date(Date.now()+process.argv[1]*864e5));console.log(t)' -- "$1"; }
alerts() { curl -s "$API/alerts?vehicleId=$V3$1" -H "$AUTH"; }
# Reutiliza el viewer del Módulo 4 para no gastar otro intento de login (límite por IP)
if [ -z "$CTOKEN" ]; then
  curl -s -o /dev/null -X POST "$API/auth/register" -H "$AUTH" -H "$J" -d "{\"email\":\"consulta$STAMP@sigmve.cl\",\"password\":\"Clave123\",\"fullName\":\"Usuario Consulta\",\"role\":\"viewer\"}"
  CTOKEN=$(login "consulta$STAMP@sigmve.cl" "Clave123")
fi
VW="Authorization: Bearer $CTOKEN"
V3=$(curl -s -X POST "$API/vehicles" -H "$OP" -H "$J" -d "{\"plate\":\"$(plate 3)\",\"type\":\"rescate\",\"brand\":\"Iveco\",\"model\":\"Daily\",\"year\":2020}" | jget id)
MV=$(curl -s -X POST "$API/maintenances" -H "$OP" -H "$J" -d "{\"vehicleId\":\"$V3\",\"type\":\"preventiva\",\"description\":\"Revision de frenos\",\"scheduledDate\":\"$(d -3)\"}" | jget id)
MP=$(curl -s -X POST "$API/maintenances" -H "$OP" -H "$J" -d "{\"vehicleId\":\"$V3\",\"type\":\"preventiva\",\"description\":\"Cambio de aceite\",\"scheduledDate\":\"$(d 2)\"}" | jget id)
check "Mantención con fecha pasada genera alerta de vencida (sin evaluar a mano)" mantencion_vencida "$(alerts '&type=mantencion_vencida' | jget 0.type)"
check "Mantención en 2 días genera alerta de próxima" mantencion_proxima "$(alerts '&type=mantencion_proxima' | jget 0.type)"
check "Las alertas se ordenan por severidad (vencida antes que próxima)" mantencion_vencida "$(alerts | jget 0.type)"
check "Consultar de nuevo no duplica alertas" 2 "$(alerts | jget length)"
check "Rol viewer SÍ puede consultar alertas" 200 "$(code "$API/alerts" -H "$VW")"
check "Filtro ?type inválido responde 400" 400 "$(code "$API/alerts?type=xx" -H "$AUTH")"
AV=$(alerts '&type=mantencion_vencida' | jget 0.id)
check "Rol viewer NO puede reconocer alertas" 403 "$(code -X PATCH "$API/alerts/$AV/acknowledge" -H "$VW" -H "$J" -d '{}')"
check "Operador reconoce la alerta" 200 "$(code -X PATCH "$API/alerts/$AV/acknowledge" -H "$OP" -H "$J" -d '{"note":"Taller confirmado para manana"}')"
check "Queda registrado quién la reconoció" "$OEMAIL" "$(curl -s "$API/alerts/$AV" -H "$AUTH" | jget acknowledgedBy.email)"
check "No se reconoce dos veces" 409 "$(code -X PATCH "$API/alerts/$AV/acknowledge" -H "$OP" -H "$J" -d '{}')"
curl -s -o /dev/null -X PATCH "$API/maintenances/$MV" -H "$OP" -H "$J" -d '{"status":"en_proceso"}'
check "Al iniciar la mantención vencida, su alerta se resuelve sola" resuelta "$(curl -s "$API/alerts/$AV" -H "$AUTH" | jget status)"
check "...y ya no aparece entre las vivas" "" "$(alerts '&type=mantencion_vencida' | jget 0.id)"
curl -s -o /dev/null -X PATCH "$API/maintenances/$MV" -H "$OP" -H "$J" -d '{"status":"completada"}'
I3=$(curl -s -X POST "$API/incidents" -H "$OP" -H "$J" -d "{\"vehicleId\":\"$V3\",\"title\":\"Falla hidraulica\",\"description\":\"Perdida de presion en el sistema de rescate\",\"severity\":\"critica\"}" | jget id)
check "Incidencia crítica genera alerta crítica" critica "$(alerts '&type=incidencia_critica' | jget 0.severity)"
curl -s -o /dev/null -X POST "$API/incidents/$I3/maintenance" -H "$OP" -H "$J" -d "{\"scheduledDate\":\"$(d 0)\"}"
check "Al asignarle mantención, la alerta de incidencia crítica se resuelve" "" "$(alerts '&type=incidencia_critica' | jget 0.id)"
check "Resumen de alertas (dashboard)" si "$(curl -s "$API/alerts/summary" -H "$AUTH" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const o=JSON.parse(s);console.log(typeof o.total==="number"&&typeof o.unacknowledged==="number"&&"critica" in o.bySeverity?"si":"no")})')"
check "Operador NO puede forzar la evaluación" 403 "$(code -X POST "$API/alerts/evaluate" -H "$OP")"
check "Admin fuerza la evaluación" 200 "$(code -X POST "$API/alerts/evaluate" -H "$AUTH")"
fi

echo "-- Resultado: $ok correctas, $fail con falla"
[ "$fail" -eq 0 ]
