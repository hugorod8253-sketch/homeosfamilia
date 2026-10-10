# Dictado y configuración del hogar

El dictado usa el reconocimiento de voz del navegador. Las reglas locales separan productos y cantidades en frases habituales; no es una conversación universal con IA. Cuando se interrumpe por error, se mantiene el texto para revisión. Al terminar normalmente, se procesa la frase una sola vez.

Comprar y guardar en Casa son intenciones diferentes. Las frases mixtas muestran las existencias o preparados pendientes para revisar en Casa; no crean consumo, gasto ni una compra por suposiciones. Los productos ambiguos mantienen las opciones de revisión. Los preparados requieren confirmar nombre, raciones y ubicación antes de guardarse.

Leche sin unidad se apunta en bricks. Una cantidad explícita en litros sigue siendo litros. No se supone que un brick equivale a un litro. Botes, botellas, paquetes y pesos explícitos conservan su unidad; las unidades de envases distintas no se suman como si fueran iguales.

Las notas del hogar se conservan como texto. Se ofrecen interpretaciones sencillas de rutinas comunes, con un botón explícito para aplicarlas. Llevar tupper no implica consumir menos comida de casa. Una excepción produce una rutina variable; una nota no reconocida pide seleccionar la rutina. Las notas nunca descuentan inventario.

La configuración inicial mantiene seis pasos y permite omitirla. Dentro de cocina y hábitos se pueden seleccionar preferencias, herramientas y presupuesto de manera opcional. Los importes semanales se convierten en una referencia mensual usando 52/12 y la equivalencia se muestra. Las preferencias no verifican alérgenos de marcas concretas.

Costco y Makro muestran una pregunta sobre reservas. Comprar allí no congela todos los productos ni modifica las tasas de consumo. Cada producto apto puede marcarse para congelar como reserva; las reservas conservan los avisos de revisión de calidad y quedan fuera de la rotación habitual.

La IA local disponible sigue destinada a generar recetas en dispositivos compatibles. Estas mejoras no descargan otro modelo, no usan un servicio de IA de pago y no afirman comprender cualquier frase posible.

Verificación: `npm run qa`, incluido `qa-household-language.ts`, y `npm run build -- --webpack`. Sigue pendiente verificar micrófono y cámara con dispositivos físicos.
