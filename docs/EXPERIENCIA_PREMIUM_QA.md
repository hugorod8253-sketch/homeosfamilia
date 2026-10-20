# HomeOS — Experiencia premium y verificación integral
**Estado revisado:** 20/10/2026 · rama `feature/homeos-premium-experience-qa-20261020` (sin fusionar ni publicar).

## Producto aprobado (mantener)
- Nombre visible: **HomeOS**; no sustituir la identidad ni mezclar otros proyectos.
- Filosofía: registrar lo mínimo, decidir qué comer / qué comprar / qué gastar de forma inmediata.
- Móvil: Inicio · Lista · Escáner · Inventario · Más (verificar implementación real antes de reorganizar).
- Identidad visual: verde, naranja y azul; compra tipo libreta con boli; recetas tipo libros ordenados por país/región/tema; iconos y fotos reconocibles, texto legible.
- Stock: lotes separados, fecha y comprador; FIFO salvo fecha de consumo preferente/caducidad más próxima; fechas estimadas marcadas como tales.
- Ninguna predicción o receta sugerida puede descontar existencias sin confirmación.
- Cuentas personales y hogares compartidos: validar seguridad y permisos en sus ramas específicas antes de fusionar.

## Recorrido ideal y criterio de aceptación
1. **Inicio sin menú:** mostrar ideas reales de desayuno/comida/cena, recetas y acceso para crear menú; no dejar huecos. Con menú, mostrar las comidas previstas y acceso al detalle.
2. **Comprar:** apuntar varias cosas sin teclear demasiado; revisar cantidades/unidades; marcar compradas; añadir lotes a Casa una sola vez; poder corregir o deshacer la acción.
3. **Casa:** separar Nevera/Congelador/Despensa; enseñar existencias registradas, incertidumbre, fecha conocida y previsión por separado; no acumular duplicados por introducir nombres casi iguales.
4. **Comer:** receta con ingredientes, cantidades y pasos coherentes. Calcular déficits **una sola vez por existencia**, respetando unidades y otros planes; revisar compra generada y revertir sin borrar productos manuales.
5. **Preparados:** confirmar al consumir, tirar, congelar y corregir. Una previsión de raciones gastadas no altera el inventario. Avisar para revisar alimentos sin inventar fechas de seguridad.
6. **Multiusuario:** operación del miembro A visible para B tras sincronización y sin duplicar compra/gasto/consumo; gestionar conflictos de cambios simultáneos y conexión intermitente.
7. **Voz, ticket y escáner:** interpretación revisable, errores accionables, permisos del dispositivo, código manual alternativo y no atribuir capacidad física sin pruebas en el móvil real.
8. **Diseño premium:** controles alcanzables y suficientemente grandes, tipografía legible, contraste, jerarquía, navegación y transición consistentes en iPhone y escritorio; movimiento reducido.

## Cambios implementados en esta rama
- **Recetas y compra:** los ingredientes repetidos o solapados comparten la misma disponibilidad en lugar de descontarla por duplicado. Las coincidencias específicas (p. ej. zanahoria) se reservan antes que grupos amplios (verdura).
- **Unidades:** evitar mezclar lonchas con unidades y raciones; admitir equivalencias verificables como L ↔ ml y kg ↔ g.
- **Preparados:** desactivar la deducción automática de raciones basada solo en el paso del tiempo; exposición explícita de la estimación y mantenimiento de controles de consumo real.
- **Pruebas:** casos de regresión añadidos al comando obligatorio `npm run qa` de la aplicación.

## Matriz de verificación
| Área | Automatizable | Manual / dispositivo | Estado |
| --- | --- | --- | --- |
| Recetas: ingredientes repetidos, unidades, FEFO | Sí: `qa-premium-journeys.ts` | Prueba E2E visual | Pendiente de CI |
| Preparados: estimación vs. consumo | Sí: `qa-premium-journeys.ts` | Uso real durante varios días | Pendiente de CI |
| Pantallas Inicio/Lista/Libro/Inventario | Tests DOM y recorrido E2E aún no disponibles | iPhone + escritorio y estados vacíos | **No verificado** |
| Cámara, linterna, micrófono, OCR de tickets | Algunos tests de utilidades | Móviles iOS/Android reales | **No verificado** |
| Multiusuario, seguridad y sincronización | Tests parciales en otras ramas | Dos dispositivos y usuario sin permisos | **No verificado** |
| Deshacer, conectividad, persistencia | Tests unitarios parciales | E2E con recarga y conexión interrumpida | **No verificado** |
| Accesibilidad, contraste, tamaño táctil | Requiere herramientas adicionales | Revisión visual y lector de pantalla | **No verificado** |

## Decisiones y límites
- No asumir que compilar equivale a experiencia validada. Un test de cálculo no sustituye pruebas móviles.
- Hay ramas abiertas de compra, cuentas familiares y consumo. Esta rama es intencionalmente acotada para no pisar trabajo de otras funciones.
- En ramas anteriores se usó un seguimiento de consumo automático de meal prep: queda sustituido por una **estimación no destructiva**.
- No se han probado hardware de móvil, permisos, producción ni carga concurrente real en este cambio.
- No fusionar ramas, hacer despliegues de producción ni habilitar servicios de pago sin revisión.

## Próximo paso comprobable
Validar los checks del PR, revisar las pantallas representativas en un móvil real (Inicio con/sin menú, Lista, Libro, Casa) y cerrar un recorrido completo compra → inventario → menú/receta → consumo → deshacer antes de declarar «premium» la experiencia.
