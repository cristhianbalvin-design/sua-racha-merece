# Buky dentro de 3BUK · Roadmap

Última actualización: 4 de noviembre de 2026.

## Hecho (en producción)

- App del atleta en `/app` con el diseño del mockup: Início, Bolsa, Fotos, Patrocínio y Perfil. Está en pt-BR.
- Juego GPS:
  - Rutas oficiales (admin) y rutas propias del atleta. El editor permite mover, quitar, insertar y deshacer puntos.
  - Validación de los entrenamientos en el servidor (velocidad, vehículo, ubicación simulada, topes).
  - Libro de Bukys inmutable.
- App nativa Android/iOS con Capacitor y GPS con la pantalla apagada.
- Sorteos:
  - Periodos con repetición automática.
  - Cupones físicos por ciudad y digitales por estado o nacionales.
  - Sorteo automático y auditable, con ganadores distintos.
  - Códigos de canje únicos: los pega el patrocinador o los genera el admin.
- Bolsa: saldo, envío al sorteio, "Prêmios em jogo" y "Meus prêmios" con el código.
- Fotos por selfie y Kit 3buk (campañas de patrocinio) dentro de la app.
- Admin Buky: rutas, sorteios, patrocinadores, treinos y atletas, configuración y testadores.

## Pendiente

| # | Ítem | Notas |
|---|---|---|
| 1 | Prueba de campo de Jesús (Icaraí) | Condición para activar la web nueva para todos (`VITE_SHOW_BUKY_APP`) |
| 2 | Ocultar Premium y la compra de fotos en la web vieja | Decisión del cliente: todo gratis por ahora |
| 3 | **Marketplace de cupones de consumo** | Ver la sección de abajo. Es distinto de los cupones del sorteio |
| 4 | Confirmar con el cliente los 3 supuestos de los sorteios | Los Bukys cuentan en todos los cupones de la zona · valen solo para ese periodo · la zona es la ciudad del perfil |
| 5 | Notificaciones push y bandeja en la app | Ganaste el sorteo, abrió un periodo nuevo, entrenamiento validado |
| 6 | "Minhas rotas" | Ver, renombrar y desactivar las rutas propias |
| 7 | Login con Google en la app nativa | |
| 8 | Publicación en las tiendas | Play: firma, ficha y declaración de ubicación en segundo plano · App Store: ficha y privacidad |
| 9 | Limpiar los datos de prueba `[TESTE]` después del piloto | |

## Marketplace de cupones de consumo (por definir con el cliente)

Hay dos tipos de cupones y no se deben mezclar:

| | Cupones del **sorteio** (ya existen) | Cupones del **marketplace** (pendiente) |
|---|---|---|
| Cómo se obtienen | Se ganan por azar: el atleta envía sus Bukys a un periodo | Se canjean directamente: el atleta "compra" el cupón con Bukys (o se lo regalan) |
| Cantidad | Pocos ganadores por periodo | Stock que define el patrocinador |
| Momento | Al cierre del periodo | En cualquier momento, mientras haya stock |
| Dónde se ven | Bolsa · "Prêmios em jogo" y "Meus prêmios" | Pestaña o sección nueva "Loja" / "Marketplace" |

Preguntas para el cliente antes de construirlo:

1. ¿Los cupones del marketplace se pagan con Bukys, son gratis o se pagan con dinero?
2. Si se pagan con Bukys, ¿compiten con el sorteio por el mismo saldo?
3. ¿Precio en Bukys por cupón, stock y límite por atleta?
4. ¿Los físicos se limitan a la ciudad del atleta, como en el sorteio?
5. ¿Quién valida el canje en la tienda (código único, QR) y si hace falta un panel para el patrocinador?
