# HomeOS — lanzamiento seguro de cuentas familiares (pendiente de activación)

## Estado

- Implementación de frontend aislada en `/cuenta` y rama `feature/secure-family-accounts`.
- **No aplicado**: `supabase/migrations/20261014_secure_household_accounts.sql`.
- **No activar** `NEXT_PUBLIC_HOMEOS_ACCOUNTS_ENABLED=true` hasta pasar todo el checklist.
- Producción actual en `/` mantiene el flujo antiguo mientras se prepara la migración.
- El código HOS1 no es una identidad personal: antes de activar cuentas nuevas no se debe reutilizar para invitaciones.

## Antes de modificar Supabase

1. Exportar y verificar una copia de las filas y del esquema de `homeos_households_v2`; comprobar que el JSON, ID y revisión pueden recuperarse. Utilizar backup PITR si está contratado o exportación segura administrada; **nunca** pegar datos reales en tickets o chats.
2. Revisar configuración de Supabase Auth: confirmación de correo, SMTP fiable, dominios autorizados, límite de solicitudes y contraseña mínima.
3. Probar la migración en base de datos **de pruebas** con cuentas e inventarios ficticios. No reutilizar credenciales reales ni activar Auth en la web pública.
4. Verificar esquema y seguridad: las tablas de miembros e invitaciones no admiten acceso directo para `anon` ni `authenticated`, no existen políticas permisivas por accidente, y todas las funciones usan `auth.uid()` con un rol autenticado.
5. Ejecutar pruebas negativas: tokens HOS1 de otros hogares, HOS2 caducado, reutilizado o mal formado, no miembro, usuario eliminado, diez intentos inválidos y miembro revocado.
6. Verificar que la función de *claim* gira el token HOS1 y **conserva exactamente** el JSON original, su revisión, fechas y los datos financieros.

## Activación gradual

1. Aplicar migración validada mediante migraciones de Supabase, con confirmación explícita sobre la base real.
2. Configurar `NEXT_PUBLIC_HOMEOS_ACCOUNTS_ENABLED=true` **solo en una rama/entorno de pruebas**, nunca directamente en la web pública.
3. Registrar cuenta propietaria, crear un hogar, completar cuestionario inicial y recargar al menos diez veces; comprobar que no vuelve a preguntar ni exige volver a iniciar sesión.
4. Entrar con tres cuentas de prueba en iPhone, iPad y ordenador. Comprobar compra simultánea, gasto único, recetas, congelador, cambios de stock, fotos de tickets y sincronización en ambos sentidos.
5. Probar sesión caducada, cierres de sesión en dos pestañas, red intermitente, corte durante escritura, conflicto de revisión y eliminación de un miembro.
6. Auditoría visual y de accesibilidad: 320/390/768/1024/1440 px, foco visible, VoiceOver, estados vacíos, textos truncados, cámara y micrófono reales con permisos.
7. Migrar solo hogares que lo soliciten, con titular presente: mostrar advertencia sobre desactivación de HOS1 y ofrecer un código HOS2 **nuevo por familiar**. No migrar automáticamente un hogar existente.
8. Monitorizar errores en preview. Habilitar el acceso público únicamente después de aprobación funcional y de seguridad.

## Invariantes

- Estado físico confirmado `inventory.qty` separado del stock estimado y consumo excepcional.
- Una compra confirmada se incorpora una vez; ningún conflicto de sincronización puede duplicar gastos.
- Ningún hogar A se mezcla con hogar B: caché por ID de usuario e ID de hogar; limpieza en cierre de sesión; autorización del servidor siempre antes de mostrar datos remotos.
- No basta un código compartido para acceder a un hogar migrado; cada miembro necesita su sesión personal.
- Una sesión persistente no significa indefinida: debe poder caducar, revocarse o borrarse.
- La **sincronización fuera de línea** y la recuperación del conflicto de cuatro dispositivos requieren pruebas reales adicionales; no prometer fiabilidad total solo con QA sintética.

## Reversión

- Si falla la activación antes de que se haya reclamado un hogar, desactivar `NEXT_PUBLIC_HOMEOS_ACCOUNTS_ENABLED`; el sistema HOS1 sigue funcionando.
- Para hogares reclamados, **no restaurar el antiguo token** ni volver a abrir RPC anónimas. Corregir vía migración de seguimiento preservando la membresía, o recuperar datos de la copia autorizada a través de una cuenta propietaria.
- No borrar tablas, usuarios ni datos de hogares en producción para resolver fallos de interfaz; revisar logs y aplicar cambios reversibles.

Relacionado: #9 y PR #8.
