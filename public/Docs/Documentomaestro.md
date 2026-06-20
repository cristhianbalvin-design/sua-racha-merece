# 3BUK — Documento Maestro del Proyecto
> *"Sua racha é seu mérito."*

---

## 1. Visión General

**3BUK** es una plataforma digital (web app + PWA instalable) para deportistas amateurs en Brasil que premia la **constancia** y la **actitud**, no el talento ni la performance. Los usuarios participan en campañas subiendo fotos (y opcionalmente comprobante de Instagram) de sus entrenamientos, y un administrador califica y asigna patrocinios basándose en tres criterios: Actitud, Compromiso y Continuidad.

**Mercado inicial:** Brasil
**Stack real verificado:** React 18 + TypeScript + Vite, Tailwind CSS + shadcn-ui, Framer Motion, React Router DOM, React Query, Supabase (Auth + Postgres + Storage + Edge Functions), OneSignal (push), React Quill (editor de Términos), PWA (vite-plugin-pwa). Testing: Vitest + Playwright. Despliegue: Vercel.
**Modelo de negocio:** Freemium con suscripción mensual (planes pagos actualmente **pausados/ocultos** en el front, ver sección 10).
**Estado actual:** En producción temprana / vibe coding activo. Existe un proyecto Supabase vinculado en el repo (`supabase/.temp`).
**Hashtag oficial:** #3bukchallenge

---

## 2. Problema que resuelve

Los deportistas amateurs abandonan o entrenan de forma irregular porque:

- Sostener el hábito tiene un costo mental, económico y social alto
- El ecosistema actual premia talento y performance, no actitud ni constancia
- El esfuerzo "invisible" nunca se reconoce
- No existe un sistema externo que sostenga la motivación cuando baja
- Las comunidades existentes son informales, temporales y desconectadas

**La brecha central:** hay una distancia enorme entre quién *merece* apoyo (por esfuerzo y hábito) y quién *recibe* apoyo (por performance y visibilidad).

---

## 3. Estados del Sistema

### Estado de Participación
| Estado (DB) | Estado mostrado en UI | Descripción |
|---|---|---|
| `Em curso` | EM CURSO | El usuario hizo click en "Quero participar" — inscripción activa, sin evidencia |
| `Concluído` | CONCLUÍDO | El usuario subió su evidencia (foto + comentario obligatorios) |
| `Não concluído` | NÃO CONCLUÍDO | Existe como valor del enum y se puede filtrar/mostrar, **pero ningún proceso del sistema lo asigna hoy** (ver Riesgo R1) |
| `Qualificado` | QUALIFICADO | El admin asignó Actitud > 0 sobre una participación Concluída |
| `Ganhador` | GANHADOR | El admin marcó al participante como ganador (sujeto a cupo de la campaña) |

### Estado de Campaña
| Estado | Descripción |
|---|---|
| **Aberto** | Estado por defecto al crear la campaña |
| **Concluído** | Cambiado manualmente por el admin desde el dropdown de la tabla de campañas, **o** automáticamente cuando se cubre y luego se revoca el cupo de ganadores |
| **Eliminado** | Opción manual en el dropdown de estado (no hay botón de "eliminar campaña" separado de este estado; existe además un botón de borrado físico, ver sección 7) |
| **Qualificado** | Asignado automáticamente cuando se alcanza `winnersCount` ganadores en la campaña |

> ⚠️ A diferencia de lo que el nombre sugiere, **el estado de campaña no se recalcula por fecha**: no hay cron job, trigger SQL ni chequeo en frontend que cierre una campaña automáticamente al pasar `end_date`. El cierre es 100% manual (dropdown en Tab Campanhas) salvo el caso de "Qualificado" por cupo lleno. Ver Riesgo R2.

### Estado de Usuario
| Estado | Descripción |
|---|---|
| **Ativo** | Usuario habilitado para participar |
| **Desabilitado** | Bloqueado para login normal (el login lo rechaza explícitamente), pero **no está excluido del listado de calificación ni de "marcar como ganador"** — ver Riesgo R3 |

---

## 4. Cómo Funciona (Core Loop)

### 4.1 Campañas
El admin crea campañas con: **nombre** (campo propio, separado de la descripción), deporte (tabla maestra), estado/región (tabla maestra), ciudad, fechas de inicio y fin, descripción del desafío, **dos imágenes obligatorias** (desktop 16:9 y mobile 9:16), cantidad de ganadores, premio (texto libre), e Instagram opcional (checkbox + hashtag personalizable, default `#3bukchallenge`).

**Cambio relevante respecto a versiones previas:** el plan de la campaña ya no es binario. El selector ofrece **Freemium / Premium / Ambos** (default: Ambos).

> ⚠️ **El plan de la campaña no se usa para filtrar nada en el front del usuario.** `Dashboard.tsx` solo filtra por deporte, estado de campaña y región — no compara `campaign.plan` contra `user.plan`. En la práctica, **todos los usuarios ven todas las campañas** sin importar el plan de cada uno. Ver Riesgo R4.

### 4.2 Flujo de participación del usuario (verificado en código)

```
1. Usuario ve campaña disponible (Tab Campanhas / Dashboard)
2. Click "QUERO PARTICIPAR" → se crea la participación con estado "Em curso"
   (no hay ningún paso de aprobación del admin en este punto)
3. Tab Minhas Participações → ve la campaña con estado "EM CURSO"
4. Sube evidencia (foto obligatoria + comentario obligatorio + checkbox IG opcional)
   → estado cambia a "CONCLUÍDO"
5. Al vencer la fecha de fin de campaña:
   → NO existe ningún mecanismo (cron, trigger o chequeo de frontend) que pase
     participaciones sin evidencia a "NÃO CONCLUÍDO" automáticamente (Riesgo R1)
6. Admin califica en Tab Qualificação → al asignar Actitud > 0, estado pasa a "QUALIFICADO"
7. Admin marca ganador (si hay cupo disponible) → estado pasa a "GANHADOR"
```

### 4.3 Condiciones reales para habilitar "Subir evidencia"

El documento anterior describía dos condiciones (aprobación del admin + campaña abierta) con textos de bloqueo específicos. **Esto ya no existe en el código.** Hoy:

- El botón **"QUERO PARTICIPAR"** en el detalle de campaña no valida fecha ni estado de la campaña: se puede participar en una campaña "Concluído", "Eliminado" o "Qualificado" igual que en una "Aberto".
- El botón **"ENVIE SUA PARTICIPAÇÃO"** (subir evidencia) se habilita únicamente si: hay 1 foto cargada, el comentario no está vacío, y (si el checkbox de Instagram está marcado) hay una captura de pantalla adjunta. No depende de ninguna aprobación previa del admin ni del estado de la campaña.
- No existen los textos "Aguardando aprovação do admin" ni "Campanha encerrada" en ninguna pantalla actual.

> ⚠️ Esta es una de las divergencias más importantes del documento (ver tabla de comparación). Señalado como riesgo de negocio/producto, no resuelto acá — ver Riesgo R5.

### 4.4 Evidencia del usuario
El usuario envía desde `/campanha/:id/participar` o desde el modal de "Minhas Participações":
- **1 foto** (obligatoria, `MAX_PHOTOS = 1`)
- **Comentário** (obligatorio)
- **Captura de pantalla de Instagram** (obligatoria *solo si* el usuario marca el checkbox "Publiquei no Instagram", que a su vez solo aparece si la campaña tiene Instagram habilitado)
- **Vídeo:** el código de carga/validación de video (máx. 1, máx. 10 segundos) está completamente implementado pero el bloque de UI está oculto con la clase `.hidden` tanto en `SubmitEvidence.tsx` como en el modal de `UserParticipations.tsx`. Es funcionalidad **parcial/oculta**, no eliminada.

---

## 5. Sistema de Calificación del Admin

### 5.1 Filosofía
Sin cambios: la calificación es manual sobre evidencia real, con tres criterios numéricos que orientan — no reemplazan — la decisión humana.

### 5.2 Elegibilidad para calificación (verificado en `AdminQualification.tsx`)
Aparecen en el Tab Qualificação los participantes que cumplan:
- Estado de participación: contiene "conclu" (Concluído), o ya es Qualificado/Ganhador (para que sigan visibles tras calificarse)
- Estado de campaña: exactamente **Concluído**

> ⚠️ El documento anterior exigía además **usuario ACTIVO** como tercera condición. El código actual **no valida `userStatus`** en este filtro: un usuario Desabilitado puede seguir apareciendo, ser calificado y marcado como ganador. Ver Riesgo R3.

### 5.3 Los tres criterios de calificación

Fórmula confirmada sin cambios: **TOTAL = (COMPROMISSO + CONTINUIDADE) × ATITUDE**, máximo real **9.5** ( (5+5) × 0.95 ).

#### 💪 Compromisso (automático, máx. 5 pts, prorrateado)
Reglas evaluadas (`calcCompromiso`, `AdminQualification.tsx`):
1. Se unió el mismo día de creación de la campaña.
2. Se unió dentro de los primeros 7 días.
3. Envió evidencia de media (foto **o** video — ver nota abajo).
4. Concluyó la participación (status Concluído/Qualificado/Ganhador).
5. *Solo si la campaña tiene Instagram habilitado:* envió captura de Instagram (+1, sobre una base de 5 reglas en vez de 4).

`score = 5 × (reglas_cumplidas / reglas_requeridas)`, donde requeridas es 4 o 5 según si la campaña pide Instagram.

> ⚠️ **Diferencia con el documento anterior:** la regla 3 decía "envió foto **y** video". El código solo exige que exista *algún* archivo de media (foto o video), no ambos. Como el campo de video está oculto en el formulario (ver 4.4), en la práctica esta regla hoy equivale a "envió la foto obligatoria" y siempre se cumple si la participación está Concluída.

#### 📅 Continuidade (automático, máx. 5 pts, suma directa)
Reglas evaluadas (`calcContinuidade`):
1. Participó (con participación Concluída o mejor) dentro de los **±31 días** desde su fecha de registro (+1).
2. Ganó dentro de esa misma ventana de ±31 días (+1).
3. Tiene participaciones en 3 o más meses calendario consecutivos (+1).
4. Tiene victorias en 3 o más meses calendario consecutivos (+1).
5. Ganó otra campaña distinta dentro del mismo mes calendario que la campaña actual (+1).

Cada regla suma exactamente 1.0 punto (no se prorratea). El rango de "primer mes" está implementado como ±31 días corridos desde el registro, no como mes calendario.

#### 🔥 Atitude (manual, 0 a 0.95)
- Input numérico, paso 0.05, rango 0–0.95.
- Validación estricta al perder foco: debe empezar con "0" y no superar 0.95 (alerta nativa del navegador si no).
- Se deshabilita una vez que la participación es Ganhador.

#### ∑ Total
- `(Compromisso + Continuidade) × Atitude`, redondeado a 2 decimales.
- Si Atitude > 0 y el estado actual contiene "conclu" → la participación pasa a **Qualificado** automáticamente al guardar.

### 5.4 Selección de ganador (con cupo)
- Botón disponible solo si la participación está **Qualificado** y la campaña **no alcanzó su cupo** de ganadores (`winnersCount`).
- Si el cupo ya está lleno, el botón se reemplaza por **"CUPO COMPLETO"** (deshabilitado).
- Al marcar ganador: el estado pasa a Ganhador, se **recalcula Continuidade** (porque la regla 5 puede activarse retroactivamente) y se recalcula el Total. Si con este ganador se cubre el cupo, la campaña pasa automáticamente a estado **Qualificado**.
- **Nuevo — no documentado antes:** botón **"REVOGAR"** sobre un Ganhador, que lo regresa a Qualificado y reabre la campaña a Concluído si estaba llena por este ganador. No recalcula Continuidade al revocar (asimetría menor, ver Riesgo R6).
- **Nuevo — no documentado antes:** campo de **Pré-qualificação** manual (Alto/Medio/Bajo) por participante, visible como botones en el modal de detalle. No afecta la fórmula; es una nota de triage para el admin.

### 5.5 Vista de detalle (modal "Detalhes")
Confirmado: galería de fotos/videos con zoom, datos del perfil y campaña, comentario, desglose visual con ✅/❌ de cada regla de Compromisso y Continuidade, fórmula final, y evidencia de Instagram (captura + confirmación de publicación).

---

## 6. Estructura de Navegación

### Usuario — navegación real (dos barras distintas en mobile, una en desktop)

La app no tiene "4 tabs" simples: tiene una barra superior, una inferior (solo mobile) y un header (solo desktop), con accesos parcialmente solapados:

| Destino | Top tabs (mobile, dentro del banner) | Bottom nav (mobile) | Header (desktop) |
|---|---|---|---|
| Campanhas (`/dashboard`) | ✅ | ✅ | ✅ |
| Participações (`/participacoes`) | ✅ | ✅ | ✅ |
| Fotografias 3BUK / Fotos | ✅ (link externo) | ✅ (link externo) | ✅ (link externo) |
| Ganhadores (`/ganhadores`) | ✅ | ❌ | ✅ |
| Notificações (`/notificacoes`) | ❌ | ✅ (con badge) | ✅ (ícono campana, con badge) |
| Meu Perfil (`/perfil`) | ❌ | ✅ | ✅ (avatar + nombre) |

> ⚠️ **Hallazgo:** la etiqueta "Fotografias 3BUK" / "Fotos" en **ambas** barras de navegación apunta a una carpeta externa de **Google Drive**, no a la página interna `/fotografias-3buk`. Esa ruta interna sí existe (`UserPhotos3buk.tsx`, muestra el popup activo configurado por el admin en Tab Popups) pero **no está enlazada desde ningún lugar de la UI** — solo es accesible tecleando la URL directamente. Ver Riesgo R7.

### Admin — navegación real (12 rutas, 10 en el menú visible)

Menú principal de `AdminLayout` (en este orden): Dashboard, Usuários, Campanhas, Participações, Qualificação, Ganhadores, Popups, Esportes, Regiões, Termos.

Dos rutas **no aparecen en ese menú**:
- **Perfil** (`/admin/perfil`) — solo accesible haciendo click en el avatar/nombre del admin en el header, no es un tab del menú.
- **Relatório** (`/admin/relatorio`) — ruta huérfana, no tiene ningún link desde ningún componente de la app. Solo accesible escribiendo la URL. Su contenido además es un stub (ver 7).

---

## 7. Detalle de Tabs del Admin

### Tab Dashboard *(nuevo, no documentado antes)*
Panel analítico en tiempo real con:
- 8 KPIs: usuários totais/ativos, campanhas totais/abertas, participações totais + taxa de conclusão, ganhadores + qualificados, % usuários Premium, nota média, participações concluídas, taxa de conversión Em curso → Concluído.
- 4 gráficos: participaciones por mes, nuevos usuarios por mes (ambos AreaChart), status de participaciones, plan de usuarios y status de campañas (PieChart donut), campañas por deporte (BarChart horizontal), Top 5 puntuaciones (BarChart).
- Funil de participación: Em curso → Concluído → Qualificado → Ganhador, con cantidades y porcentajes.
- Tabla de ranking de los participantes con mayor Nota Total.

### Tab Usuários
- Filtros: status, estado (UF), cidade, plano.
- Tarjetas con avatar, nombre, badge de plan, ubicación, email.
- Botón **Desativar/Ativar** (toggle de `user_status`).
- Botón **Detalhes** → modal con status, plan, ubicación, deporte, conteo de participaciones y victorias.
- **Nuevo, no documentado antes:** botón de **eliminar usuario** (papelera) con modal de confirmación. Borra el perfil, sus participaciones y notificaciones, e intenta borrar la cuenta de auth vía una función RPC (`delete_auth_user`) que **no existe en ningún archivo SQL del repositorio** — ver Riesgo R8.

### Tab Campanhas
- Filtros: nombre, deporte, mês da campanha, estado da campanha.
- Tabla: Campanha, Esporte, Mês da Campanha, Estado (dropdown editable inline), botón eliminar.
- Botón **Nova Campanha** → formulario con: nombre, deporte, estado/UF, ciudad, fecha inicio/fin, descripción, **imagem desktop (16:9) e imagem celular (9:16)** — ambas obligatorias —, tipo de plano (**Freemium / Premium / Ambos**), cantidad de ganadores, premio (texto libre), Instagram opcional + hashtags (default `#3bukchallenge`).
- **Nuevo, no documentado antes:** botón de **eliminar campaña** con confirmación, que borra en cascada las participaciones (y notificaciones) asociadas.

### Tab Participações
- Filtros (6, no 5): campanha (búsqueda libre), plano, esporte, mês da campanha, estado de participação, estado de campanha.
- Tabla de **solo lectura**, 7 columnas: Participante, Plano, Esporte, Campanha, Mês da Campanha, Est. Participação, Est. Campanha.

> ⚠️ El documento anterior describía un botón **"Ver detalhes"** con modal de evidencia, comentario e historial. **Ya no existe en la UI.** El código conserva una variable de estado `showDetail` sin usar — indicio de que la funcionalidad fue retirada o quedó a medio terminar. Marcado como parcial/eliminado.

### Tab Qualificação
- Encabezado fijo con la fórmula: "TOTAL = (COMPROMISSO + CONTINUIDADE) × ATITUDE · Máx 9.5 pontos".
- Filtros: búsqueda por campaña, esporte, mês de campanha, est. campanha, **pré-qualificação** (Alto/Medio/Bajo/Sin precalificar) — este último filtro es nuevo.
- Columnas: Participante (+ badge "DESABILITADO" si corresponde), Esporte, Campanha, Mês de Campanha, Vencimento, Est. Campanha (+ contador "X/Y 🏆" de cupo de ganadores), Atitude (input editable), Compromisso (auto, con tooltip de reglas), Continuidade (auto, con tooltip de reglas), Total, **Pré-qualificação** (nuevo), Ações.
- Acciones: **Detalhes** (modal completo), **🏆 Ganhador** / **Cupo completo** (deshabilitado) / **Ganhador + Revogar** según estado y cupo.

### Tab Ganhadores
- Filtros: campanha, esporte, mês de campanha, estado de entrega (Entregado/Pendiente).
- Columnas: Participante (con medalla 🥇🥈🥉 cíclica), Esporte, Campanha, Mês da Campanha, Prêmio, Estado de entrega, Ações (Detalhes + Entregar/Desfazer).
- No existe una tabla `winners` separada: este tab consulta `participations` filtrando `status = 'Ganhador'` y hace join con `users`/`campaigns`.

### Tab Popups *(nuevo módulo, no documentado antes)*
- CRUD de banners promocionales que aparecen en la **home pública** (Landing) y en `/fotografias-3buk` (ruta huérfana del lado del usuario, ver sección 6).
- Formulario: nombre, imagen (4:3, obligatoria), fecha activa desde/hasta.
- Tabla de popups publicados con badge Ativo/Inativo según la ventana de fechas, y botón eliminar.
- El popup activo se descarta por sesión (`sessionStorage`) si el usuario lo cierra en la Landing.

### Tab Termos e Condições *(nuevo módulo, no documentado antes)*
- Editor WYSIWYG (React Quill) con preview en tiempo real, y un tab de **Histórico** con todas las versiones guardadas.
- Cada guardado nuevo crea una versión incremental; solo una versión puede estar `is_active = true` a la vez; se puede reactivar una versión anterior.
- El checkbox de aceptación de términos es **obligatorio** en el registro por email (el trigger de base de datos rechaza el alta si `accepted_terms` no es `true`). Para registro con Google, el trigger crea el usuario con `accepted_terms = false` y la app bloquea la navegación con un modal hasta que el usuario acepta explícitamente.

### Tab Perfil (admin) *(nuevo, no documentado antes)*
Edición del nombre visible y avatar del propio administrador. No tiene relación con la gestión de atletas.

### Tab Relatório
- 4 KPIs básicos (usuarios activos, campañas abiertas, total de participaciones, ganadores).
- Sección de "métricas detalladas" es un cartel estático: *"Gráficos de análise serão integrados com a API do Supabase na próxima fase."*
- **Estado: stub/placeholder, y además huérfano de navegación** (ver sección 6). Es, en la práctica, una funcionalidad no terminada y no accesible para el admin salvo que conozca la URL.

### Tabs Esportes y Região Geográfica
Sin cambios funcionales respecto al documento anterior: alta de texto libre + listado + eliminar, reutilizados en todos los dropdowns de la plataforma (deporte/estado del perfil, campañas, filtros).

---

## 8. Flujo del Usuario (completo, verificado)

```
1. Registro       → email + contraseña (checkbox de Términos obligatorio) o Google OAuth real
2. (Selección de plan oculta: /plano redirige directo a /completar-perfil)
3. Completar Perfil → avatar opcional, nombre, ciudad, estado, deporte favorito, teléfono, sexo, fecha de nacimiento
4. Tab Campanhas   → ver todas las campañas (sin filtro de plan) + filtro deporte/estado de campaña/región
5. Click "QUERO PARTICIPAR" → participación creada en estado EM CURSO (sin paso de aprobación)
6. Tab Participações → ver campaña EM CURSO, botón para subir evidencia (modal o página dedicada)
7. Subir evidencia  → foto + comentario obligatorios, IG opcional → estado CONCLUÍDO
8. (No hay cierre automático de campaña ni de participación por fecha — ver Riesgo R1/R2)
9. Tab Notificações → historial in-app de cambios de estado (lectura/marcar leído)
10. Tab Meu Perfil  → editar datos + ver galería de fotos/videos propios + estadísticas (participadas/ganadas)
```

---

## 9. Flujo del Admin (completo, verificado)

```
1. Login              → /admin, email + contraseña (mismo mecanismo de auth que usuarios, validado por rol)
2. Tab Esportes / Região → gestionar tablas maestras
3. Tab Usuários       → ver lista, deshabilitar/habilitar, ver detalle, eliminar
4. Tab Campanhas      → crear campaña (con 2 imágenes + plan Freemium/Premium/Ambos), cambiar estado, eliminar
5. Tab Participações  → revisar reporte con 6 filtros (solo lectura, sin acciones)
6. Tab Qualificação   → calificar elegibles (Concluído + Concluído de campaña; SIN validar usuário Ativo)
                        → Compromisso y Continuidade se calculan solos; Atitude es manual
                        → marcar ganador (sujeto a cupo) o revocar ganador
7. Tab Ganhadores     → marcar/desmarcar entrega de premio
8. Tab Dashboard / Relatório → métricas (Dashboard funcional y completo; Relatório es un stub huérfano)
9. Tab Popups / Termos → gestionar banners de home y versiones de Términos y Condiciones
```

---

## 10. Modelo de Negocio

### 10.1 Planes

| | Plan Freemium | Plan Premium |
|---|---|---|
| Precio | R$0 | A definir |
| Rango de premios (copy de marketing) | R$70 – R$200 | R$200 – R$400 |
| Selección visible para el usuario | Oculta (`SHOW_PAID_PLANS = false`, `/plano` redirige a completar perfil) | Oculta |
| Filtrado de campañas por plan | No implementado en frontend (ver Riesgo R4) | No implementado |
| Perfil público + edición | ✅ | ✅ |

> El campo `plan` sigue existiendo en `users` y en `campaigns` (con la opción adicional "Ambos" en campañas), pero hoy es metadata sin aplicación funcional: no condiciona qué campañas ve un usuario ni qué puede hacer.

### 10.2 Pagos
**No hay integración de pagos en el código** (no hay Stripe, Mercado Pago ni librería de cobro en `package.json`, ni tablas de transacciones/suscripciones en el esquema). Confirma lo previsto en el documento anterior: el MVP no requiere pagos automáticos.

### 10.3 Financiamiento de premios
Sin cambios — sigue siendo un esquema conceptual (no hay lógica de pool de premios en el código):
```
Ejemplo base:
100 usuarios Premium × R$X = pool mensual
├── 65% → Premios de campañas
└── 35% → Operación y crecimiento
```

---

## 11. Integraciones Externas (sección nueva)

| Integración | Uso real verificado |
|---|---|
| **Supabase** | Auth (email/password + Google OAuth), Postgres (toda la persistencia), Storage (buckets `avatars`, `evidences`, `popups`), Edge Functions (Deno) |
| **OneSignal** (`react-onesignal`, App ID hardcodeado en `App.tsx`) | Push notifications. Inicializado para todos los usuarios. El admin puede "Ativar Push" desde su header y queda etiquetado `role=admin`. La única notificación push real disparada hoy es al **registrar un nuevo usuario**, enviada a los admins (Edge Function `send-push-notification`). No hay push a usuarios por cambio de estado, nueva campaña o premio. |
| **Google OAuth** | Real (no solo visual). El trigger de base de datos distingue alta por email (exige `accepted_terms = true`) de alta por Google (crea con `accepted_terms = false` y la app fuerza la aceptación con un modal bloqueante post-login). |
| **Vercel** (`vercel.json`) | Plataforma de despliegue. |
| **PWA** (`vite-plugin-pwa`, `manifest.webmanifest`, service worker) | App instalable; si se detecta modo standalone, la Landing redirige directo a `/login`. |
| **Instagram** | No es una integración técnica real (no hay API de Instagram conectada): el "checkbox de Instagram" es una autodeclaración del usuario + carga manual de una captura de pantalla. |

No se encontró integración de analítica externa (GA, Mixpanel, etc.) en el código.

---

## 12. Tablas Maestras

Confirmadas dos tablas maestras de catálogo simple (nombre + alta/baja): **Esportes** (`sports`) y **Região Geográfica** (`regions`), reutilizadas en todos los dropdowns. Se agregaron además dos tablas de configuración de contenido que funcionan como maestros de un solo registro activo a la vez:
- `home_popups` (banners de home, múltiples registros con ventana de fechas)
- `terms_and_conditions` (versionado, una sola versión activa)

---

## 13. Notificaciones

Confirmado: el historial de notificaciones del usuario (`Tab Notificações`) sigue siendo **solo lectura/marcado de leído** sobre una tabla `notifications` — pero esa tabla **no tiene ningún archivo SQL en el repositorio que la cree** (ver Riesgo R8). Además, no se encontró ningún punto del código que **inserte** filas nuevas en `notifications`: ni al cambiar el estado de una participación, ni al crear una campaña, ni al marcar un ganador. El sistema de notificaciones in-app parece estar **a medio construir**: la pantalla y las funciones de lectura existen, pero no hay generador de eventos.

El push de OneSignal (ver sección 11) es el único canal de notificación que dispara algo hoy, y solo para un evento (alta de usuario, hacia admins).

---

## 14. Riesgos Técnicos Detectados (no resueltos en este documento)

Estos hallazgos surgen de comparar el frontend (TypeScript) contra los archivos SQL versionados en el repositorio (`supabase_schema.sql`, `add_campaign_image.sql`, `add_campaign_name.sql`, `add_home_popups.sql`, `add_terms_and_conditions.sql`, `update_trigger_google_auth.sql`). **No se intentó resolverlos ni asumir cuál lado tiene razón** — quedan señalados para que el equipo confirme contra el proyecto Supabase real (vinculado en `supabase/.temp`, no inspeccionado en esta auditoría):

- **R1 — "Não concluído" es un estado inalcanzable hoy.** Existe en el enum de base de datos y en toda la UI (badges, filtros), pero ningún trigger, cron ni código de cliente lo asigna jamás. La regla de negocio "si no subió evidencia antes del cierre, pasa a Não concluído" no está implementada.
- **R2 — Cierre de campañas 100% manual.** No hay cron job, pg_cron, Edge Function programada ni chequeo de fecha que cambie el estado de una campaña vencida. Depende de que el admin cambie el dropdown manualmente.
- **R3 — Elegibilidad de calificación no valida usuario activo.** `AdminQualification.tsx` filtra por estado de participación y de campaña, pero no por `userStatus`. Un usuario deshabilitado puede ser calificado y ganar.
- **R4 — El plan de la campaña no filtra nada en el Dashboard del usuario.** Contradice tanto el documento anterior como el propio formulario de creación de campañas (que sigue pidiendo Freemium/Premium/Ambos).
- **R5 — El flujo de aprobación del admin antes de subir evidencia, descrito en la versión anterior del documento, no existe en el código actual.** Tampoco existe el gateo por estado de campaña en el botón de evidencia.
- **R6 — Asimetría en "Revogar ganador":** al marcar ganador se recalcula Continuidade; al revocar, no. Puede dejar el Total desactualizado tras una revocación.
- **R7 — Confusión de nombres "Fotografias 3BUK":** la navegación apunta a una carpeta de Google Drive externa; existe además una página interna homónima (`/fotografias-3buk`) que muestra el popup activo del admin y que no tiene ningún enlace desde la UI.
- **R8 — Desincronización entre el código y los archivos SQL versionados.** El frontend usa activamente una tabla `notifications`, una columna `campaigns.image_url_mobile`, columnas `users.phone` / `users.gender`, y una función RPC `delete_auth_user` — **ninguno de estos cuatro elementos aparece en ningún archivo `.sql` del repositorio.** O bien existen en la base de datos real de Supabase por cambios aplicados directamente desde el dashboard (sin dejar rastro versionado en el repo), o estas operaciones fallan en producción. Se recomienda hacer un `pg_dump`/introspección directa del proyecto Supabase vinculado para confirmar el esquema real antes de tomar esta sección como definitiva.
- **R9 — Vestigio de la fórmula vieja en el esquema:** `participations.commitment_score` tiene `DEFAULT 10` en `supabase_schema.sql`, resabio de una versión anterior donde Compromisso era fijo en 10. El código siempre sobreescribe este valor con el cálculo real (máx. 5), pero cualquier inserción manual o directa a la tabla heredaría el default incorrecto.
- **R10 — Credenciales/roles hardcodeados:** la contraseña de ejemplo `'password123'` y los emails de admin (`admin@3buk.com`, `cristhianbalvin@gmail.com`) están escritos directamente en `AuthContext.tsx` en vez de derivarse exclusivamente de `users.role` o de variables de entorno.

---

## 15. Riesgos y Mitigaciones (negocio)

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Percepción de favoritismo en calificación | Alta | Criterios numéricos + reglas automáticas visibles en tooltips y modal de detalle |
| Usuario confundido por la falta de filtro de plan | Media | Definir si el filtro de plan se reactiva o se elimina formalmente del modelo (ver R4) |
| Baja conversión a Premium | Media | Planes pagos siguen ocultos; no hay urgencia mientras no se reactiven |
| Pool de premios insuficiente al inicio | Alta | Validar con premios propios antes de escalar |
| Admin desbordado con muchos participantes | Media | Filtros eficientes ya implementados en Qualificação, Participações y Ganhadores |
| Campañas vencidas que quedan abiertas indefinidamente | Alta | Cerrar manualmente hasta que se resuelva R1/R2, o construir el job automático |

---

## 16. Funcionalidades del Producto (estado real)

### Usuario
- [x] Registro con correo y contraseña, con checkbox de Términos obligatorio
- [x] Login con Google OAuth real
- [x] Recuperación de contraseña (forgot/reset password) — **no documentado antes**
- [ ] Selección de plan visible (Freemium/Premium) — página existe pero está oculta/redirigida
- [x] Perfil: nombre, ciudad, país, estado, deporte, teléfono, sexo, fecha de nacimiento, foto + edición
- [x] Tab Campanhas: filtro por deporte + estado de campaña + región geográfica
- [ ] Filtro de campañas por plan del usuario (documentado, no construido — ver R4)
- [x] Click "Participar" → cambia estado a EM CURSO (sin formulario de evidencia en ese paso)
- [x] Tab Participações: estados EM CURSO / CONCLUÍDO / QUALIFICADO / GANHADOR
- [ ] Estado NÃO CONCLUÍDO automático por vencimiento (enum existe, mecanismo no — ver R1)
- [x] Subida de evidencia: foto + comentario obligatorios, IG opcional con captura
- [ ] Gateo de subida de evidencia por aprobación del admin y por estado de campaña (documentado antes, no existe hoy — ver R5)
- [x] Tab Notificações: historial in-app (lectura/marcado), sin generación automática de eventos (ver sección 13)
- [x] Galería personal de fotos/videos en Meu Perfil — **no documentado antes**
- [x] PWA instalable — **no documentado antes**
- [ ] Subida de video como evidencia (implementado en código, oculto en UI — parcial)

### Admin
- [x] Login diferenciado por rol
- [x] Tab Esportes y Região Geográfica: CRUD básico
- [x] Tab Usuários: lista + estado + deshabilitar/habilitar + ver detalle + **eliminar usuario** (nuevo)
- [x] Tab Campanhas: CRUD con 2 imágenes obligatorias, plan Freemium/Premium/Ambos, **eliminar campaña** (nuevo)
- [x] Tab Participações: reporte con 6 filtros (sin acciones; "Ver detalhes" fue retirado — ver comparación)
- [x] Tab Qualificação: Compromisso/Continuidade automáticos, Atitude manual, Total, cupo de ganadores, **revocar ganador**, **pré-qualificação** (los tres últimos, nuevos)
- [x] Tab Ganhadores: reporte + marcar/desmarcar entrega de premio
- [x] Tab Dashboard: 8 KPIs + 4 bloques de gráficos + funil + ranking — **no documentado antes**
- [x] Tab Popups: gestión de banners de home — **módulo nuevo completo**
- [x] Tab Termos e Condições: editor WYSIWYG versionado — **módulo nuevo completo**
- [x] Tab Perfil (admin): edición de nombre/avatar propio — **no documentado antes**
- [ ] Tab Relatório con gráficos reales (sigue siendo stub, y además quedó sin link de navegación)

### Should Have (v1.5) — estado real
- [ ] Notificaciones push/email automáticas por cambio de estado — **parcial**: la infraestructura de push (OneSignal) existe y funciona, pero solo se usa para avisar a admins de nuevos registros, no para notificar a usuarios
- [ ] Feed público de participaciones — no construido
- [x] Integración real con Google Login — **construido** (estaba listado como pendiente antes)
- [ ] Exportación del reporte a Excel/PDF — no construido

### Nice to Have (v2.0) — estado real
- [ ] App móvil nativa (iOS/Android) — no construido (existe PWA, que no es lo mismo)
- [ ] Integración con Strava/Apple Health — no construido
- [ ] Pagos automáticos de suscripción — no construido
- [ ] API para marcas patrocinadoras — no construido

---

## 17. Nombre y Branding

**Nombre:** 3BUK
**Logo:** "3" en verde con rayo amarillo-azul, "buk" en blanco, fondo negro
**Paleta:**
- Negro: `#000000`
- Verde: `#1A7A2E`
- Amarillo: `#F5C800`
- Azul celeste: `#00AEEF`
- Blanco: `#FFFFFF`

**Tagline:** *"Sua racha é seu mérito."* (en la Landing actual aparece como *"Seu esforço merece patrocínio."*, ambas convivían en el copy auditado)
**Hashtag oficial:** `#3bukchallenge` (personalizable por campaña)
**Tono:** motivador, directo, auténtico — habla de igual a igual con el amateur que se esfuerza.

---

## 18. Changelog

**Versión 2.0 (actual)** — Reescritura completa a partir de auditoría exhaustiva del código real (frontend, lib de acceso a datos, esquema SQL versionado, Edge Functions). Cambios principales respecto a v1.5:
- Se documentaron 7 módulos/funcionalidades construidos y no documentados: Dashboard admin con KPIs/gráficos, Tab Popups, Tab Termos e Condições (versionado), Tab Perfil admin, recuperación de contraseña, push notifications (OneSignal), PWA instalable, galería personal de usuario, cupo de ganadores + revocar ganador + pré-qualificação en Qualificação.
- Se corrigieron 6 reglas documentadas que cambiaron en el código: flujo de aprobación del admin para subir evidencia (eliminado), filtro de campañas por plan (no implementado), regla de Compromisso #3 (foto+video → foto-o-video), elegibilidad de calificación (ya no valida usuario activo), botón "Ver detalhes" en Tab Participações (retirado), plan de campaña binario → tridente (Freemium/Premium/Ambos).
- Se reclasificaron como pendientes reales (no construidos) varios ítems que el documento daba por hechos implícitamente: cierre automático de campañas por fecha, transición automática a "Não concluído", filtro de plan, exportación de reportes, notificaciones automáticas por evento.
- Se agregó una sección nueva de **Riesgos Técnicos** (10 hallazgos, incluida una posible desincronización entre el esquema SQL versionado en el repo y la base de datos real de Supabase) que se deja señalada sin resolver, a la espera de confirmación del equipo.
- Número de versión actualizado de 1.5 a 2.0 dado el volumen de cambios estructurales.
