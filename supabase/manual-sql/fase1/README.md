# SQL manual — Fase 1 (3BUK)

Scripts que se ejecutan **a mano en el SQL Editor de Supabase** (no son migraciones automáticas).
Cada uno es idempotente salvo que se indique lo contrario.

| Orden | Archivo | Qué hace | Estado |
|---|---|---|---|
| 08 | `08_fix_handle_new_user_fotografo.sql` | Permite crear la cuenta de un fotógrafo invitado | Aplicado |
| 07 | `07_descargas_biblioteca.sql` | Tabla `photo_downloads`, `check_and_register_download` con registro y `get_my_downloads` | Se aplica con el 10 |
| 09 | `09_proteger_columnas_users.sql` | Protege `campaigns_won`, `campaigns_participated` y `email` | Se aplica con el 10 |
| 10 | `10_aplicar_paso7_y_paso9.sql` | **Ejecutar este:** junta 07 + 09 en un solo script | Pendiente |
| 11 | `11_endurecimiento_prelanzamiento.sql` | Cierra lectura de embeddings, buckets abiertos, funciones trigger y `search_path` | Pendiente (después del 10) |

Los scripts 01–06 (créditos, Premium, portal de fotógrafos) se aplicaron antes de crear esta carpeta
y no están guardados aquí.
