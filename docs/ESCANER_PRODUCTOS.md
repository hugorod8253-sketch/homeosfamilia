# Escáner HomeOS

Implementado: acceso global «Escanear», alimentación/cosmética, cámara mediante ZXing, lectura local de foto y código escrito; API v3 de Open Food Facts / Open Beauty Facts, identificación de HomeOS, caché acotada de datos públicos y manejo de errores. No se consulta Yuka ni se usan sus puntuaciones.

La ficha muestra nombre, marca, presentación, nutrientes y Nutri-Score publicado cuando existen, NOVA, ingredientes, aditivos y alérgenos declarados. Cosméticos muestran composición, sin inferir seguridad o eficacia. La ausencia de información nunca se presenta como ausencia de alérgenos. Fotos de envases no se envían al proveedor. La consulta transmite solo el código y tipo de producto, junto a los datos técnicos de conexión.

«Añadir a la compra» crea una intención, no inventario ni gasto. «Registrar en casa» registra una observación con cantidad según los envases elegidos, sin inventar fecha de compra ni caducidad. Consulta o pulsación repetida no duplica productos de la lista; envases adicionales en casa requieren la acción explícita. Se conservan código, marca y presentación al terminar la compra. Una presentación desconocida permanece en paquetes, no en gramos supuestos.

Los datos públicos consultados conservan fuente/licencia ODbL y no se convierten en el catálogo privado propio de HomeOS; inventario y cantidades del hogar son observaciones del usuario. No se redistribuyen imágenes del proveedor. Revisar las obligaciones de reutilización y registrar la aplicación en el formulario del proveedor antes de escalar comercialmente.

## Validación
- Pruebas de checksum, ceros iniciales, unidades y multipacks, separación alimento/cosmético, campos ausentes, duplicados, compra→inventario y registro sin gasto.
- Respuestas reales: alimento 3017620422003, cosmético 3560070791460.
- Pruebas generales de HomeOS y compilación.
- La lectura de cámara física en iPhone/Android y la calidad con envases reales necesitan validación en esos dispositivos. La entrada manual funciona como alternativa.

## Pendiente comercial
- No hay cobros, suscripción ni precio configurados por este cambio.
- Antes de cobrar: cuentas, almacenamiento/sincronización fiable, permisos y gestión del hogar, pruebas físicas, soporte y flujo de cancelación. El proveedor puede tener productos ausentes y límites de uso; no prometer catálogo completo.
- Una valoración cosmética comparable a Yuka, recomendaciones de alternativas y una puntuación propia requieren fuentes y validación independientes. No crear una nota con IA sin datos.

## Fuentes
- https://openfoodfacts.github.io/documentation/docs/Product-Opener/v3/products/get-api-v3-product-code/
- https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/tutorials/scanning-cosmetics-pet-food-and-other-products/
- https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/tutorials/license-be-on-the-legal-side/
- https://github.com/zxing-js/browser
