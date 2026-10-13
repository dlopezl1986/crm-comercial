#!/bin/sh
# Crea el usuario de pruebas en el emulador LOCAL de Firebase Auth (nunca en producción).
# Uso: npm run emulators  (en otra terminal)  y después  sh scripts/seed-emulator.sh
EMAIL="prueba@crm.test"
PASSWORD="prueba-local-123"
curl -s -X POST "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"returnSecureToken\":false}" > /dev/null && echo "Usuario de pruebas listo: $EMAIL"
