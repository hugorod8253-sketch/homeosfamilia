# Escáner de productos — preparación

Estado: adaptador de consulta implementado y probado con respuestas simuladas. No está conectado a la interfaz ni activado en producción. No replica las puntuaciones de Yuka.

## Preparado
- Validación de códigos GTIN, conservando ceros iniciales y verificando el dígito de control.
- Consulta de solo lectura a API v3 de Open Food Facts / Open Beauty Facts.
- Nombre, marca, tamaño comercial, ingredientes, alérgenos disponibles, nutrientes por 100 g y Nutri-Score publicado para alimentos.
- Cosméticos sin puntuación nutricional ni valoración inventada de seguridad.
- Fuente y licencia incluidas; errores de conexión, producto ausente y límite de consultas permiten continuar manualmente.
- No envía tickets, fotos ni inventario a estos proveedores. La consulta transmite el código y los datos técnicos habituales de conexión.

## Para terminar
1. Validar respuestas reales de ambos proveedores y sus cambios de esquema; registrar la aplicación e identificar correctamente las solicitudes conforme a sus instrucciones.
2. Añadir cámara con permiso explícito, lectura compatible con iPhone/Android y entrada manual alternativa. No instalar una IA de pago.
3. Mostrar ficha compacta y acciones separadas «Añadir a la compra» / «Registrar en casa». Consultar no implica comprar; registrar otra vez debe conservar lotes y evitar duplicados.
4. Mantener catálogo abierto y atribución separados del inventario privado del hogar; revisar obligaciones ODbL antes de mezclar o redistribuir datos. No se usan fotos del proveedor en esta primera base.
5. Mostrar «Sin datos» cuando falten valores. Una lista vacía de alérgenos no garantiza ausencia. No deducir caducidad a partir del código de barras.
6. Comparar alternativas solo con datos suficientes, por categoría y presentación comparable. La valoración de ingredientes cosméticos y una puntuación propia requieren un trabajo independiente con fuentes revisadas.
7. Pruebas reales de cámara, etiquetas españolas, conexión lenta, productos ausentes, permisos denegados, unidades y lista/inventario. Opcionalmente pedir al usuario unos códigos/fotos de productos habituales cuando se retome.

## Fuentes oficiales
- https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/tutorials/scanning-cosmetics-pet-food-and-other-products/
- https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/tutorials/license-be-on-the-legal-side/

Pruebas: `node --import tsx scripts/qa-barcode-product.ts`.
