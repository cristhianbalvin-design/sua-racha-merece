# 3BUK — SMOKE TEST
> *"Sua racha é seu mérito"* — Plataforma para deportistas amateurs en Brasil

---

**Fecha:** ___________________
**Testeador:** ___________________
**Ambiente:** ☐ Local   ☐ Staging   ☐ Production
**Versión:** v1.5
**URL:** ___________________
**Rol testeado:** ☐ Admin   ☐ Usuario

---

## A) AUTENTICACIÓN

### ROL ADMIN
- [ ] Puedo acceder a /admin con credenciales de administrador (Credenciales no válidas)
- [ ] El header muestra fondo verde oscuro y badge "ADMIN" visible
- [x] Las credenciales incorrectas muestran mensaje de error
- [ ] La sesión persiste al recargar la página
- [x] Un usuario sin sesión es redirigido al login
- [ ] Puedo cerrar sesión correctamente

### ROL USUARIO
- [x] Puedo crear una cuenta nueva con correo y contraseña
- [ ] El botón "Entrar com Google" es visible (aunque no funcional en MVP) (Falla en el login)
- [x] Puedo iniciar sesión con cuenta existente
- [ ] Las credenciales incorrectas muestran error (No muestra toast en el UI)
- [x] La sesión persiste al recargar la página
- [x] Puedo cerrar sesión correctamente
- [x] Usuarios sin sesión son redirigidos al login

---

## B) ONBOARDING DE USUARIO (post-registro)

- [x] Después del registro, se muestra la pantalla de selección de plan
- [x] Se ven dos opciones: FREEMIUM (R$70–R$200) y PREMIUM (R$200–R$400)
- [x] Puedo seleccionar FREEMIUM y continuar
- [ ] Puedo seleccionar PREMIUM y continuar
- [x] Después de seleccionar plan, se muestra el formulario de perfil
- [x] Puedo completar: nombre, ciudad, país, deporte favorito y foto (Nota: País no estaba en el UI grabado)
- [x] El deporte favorito se selecciona de una lista desplegable
- [x] El perfil se guarda correctamente y muestra los datos ingresados

---

## C) ROL USUARIO — TABS Y NAVEGACIÓN

### Tab: Campanhas
- [x] Veo campañas disponibles filtradas según mi plan (Freemium o Premium)
- [ ] Un usuario Freemium NO ve campañas Premium (y viceversa)
- [x] El filtro por deporte funciona y actualiza la lista
- [x] El filtro por estado geográfico funciona y actualiza la lista
- [x] Cada campaña muestra: deporte, badge de plan, ciudad, fechas y descripción
- [x] El botón "Participar" está visible en cada campaña
- [x] Al hacer click en "Participar", el estado de participación cambia a EN CURSO
- [x] La campaña aparece inmediatamente en Tab Mis Participaciones con estado EN CURSO

### Tab: Minhas Participações
- [x] Veo la lista de campañas en las que me inscribí
- [x] Los estados se muestran correctamente: EN CURSO, CONCLUIDO o NO CONCLUIDO
- [x] El botón "Registrar participação" aparece en cada participación EN CURSO
- [ ] El botón está DESHABILITADO (gris) si el admin no aprobó — tooltip *"Aguardando aprovação do admin"* (BUG: Está activo)
- [ ] El botón está DESHABILITADO (gris) si la campaña ya cerró — tooltip *"Campanha encerrada"*
- [ ] El botón está HABILITADO (verde) solo si el admin aprobó Y la campaña está ABIERTA (BUG: Habilitado sin aprobación)
- [x] Al hacer click en el botón habilitado, se abre el formulario de evidencia
- [ ] El formulario permite subir fotos (múltiples)
- [ ] El formulario permite subir video
- [ ] El formulario tiene campo de comentario opcional
- [ ] El formulario tiene checkbox de publicación en Instagram con hashtag de la campaña
- [ ] Al enviar, el estado de participación cambia a CONCLUIDO
- [ ] Aparece mensaje de confirmación post-envío

### Tab: Notificações
- [ ] Veo el historial cronológico de notificaciones
- [ ] Las notificaciones muestran: ícono, texto descriptivo, fecha y hora
- [ ] El estado vacío muestra un mensaje motivador
- [ ] Los cambios de estado generan notificaciones en tiempo real

### Tab: Meu Perfil
- [ ] Veo mis datos: avatar, nombre, badge de plan, ciudad y deporte
- [ ] Veo mis estadísticas: campañas participadas y campañas ganadas
- [ ] El formulario de edición de perfil está disponible
- [ ] Puedo cambiar: nombre, ciudad, país, deporte y foto de perfil
- [ ] Al guardar, los datos se actualizan correctamente
- [ ] La galería de participaciones anteriores es visible

---

## D) ROL ADMIN — TABLAS MAESTRAS

### Tab: Deportes
- [x] Veo la lista de deportes registrados en la plataforma
- [x] Puedo agregar un nuevo deporte desde el botón "Agregar deporte"
- [x] El nuevo deporte aparece en la lista inmediatamente
- [ ] Puedo editar un deporte existente
- [ ] Puedo desactivar un deporte existente
- [x] La lista de deportes se refleja en el dropdown del formulario de campaña

### Tab: Região Geográfica
- [x] Veo la lista de regiones/estados geográficos registrados
- [x] Puedo agregar una nueva región desde el botón "Agregar región"
- [x] La nueva región aparece en la lista inmediatamente
- [ ] Puedo editar o eliminar regiones existentes
- [x] La lista de regiones se refleja en el dropdown del formulario de campaña

---

## E) ROL ADMIN — USUARIOS Y CAMPAÑAS

### Tab: Usuários
- [ ] Veo la lista de usuarios con: nombre, ciudad, deporte, tipo de cuenta, estado
- [ ] El estado se muestra correctamente: ACTIVO o DESHABILITADO
- [ ] El botón "Deshabilitar" está disponible para usuarios ACTIVOS
- [ ] Al hacer click en "Deshabilitar", el estado cambia a DESHABILITADO
- [ ] El botón se desactiva / desaparece después de deshabilitar al usuario
- [ ] No hay botones de aprobación de usuarios (solo deshabilitar)

### Tab: Campanhas
- [x] Veo el reporte de campañas ordenado por fecha (más recientes primero)
- [x] Las columnas muestran: nombre, deporte, estado de campaña
- [x] Los estados se muestran correctamente: ABIERTO, CONCLUIDO, ELIMINADO, CALIFICADO
- [ ] El filtro por nombre de campaña funciona
- [ ] El filtro por estado de campaña funciona
- [ ] El filtro por deporte funciona
- [x] El botón "Nueva Campaña" abre el formulario de creación
- [x] El formulario tiene: nombre, deporte (dropdown), estado geográfico (dropdown), ciudad, fechas
- [ ] El formulario tiene selector de plan: FREEMIUM / PREMIUM
- [ ] El check de Instagram, cuando activado, muestra campo de hashtag(s)
- [x] El formulario tiene campos de cantidad de ganadores y premio por posición
- [x] Al publicar, la campaña aparece en el reporte con estado ABIERTO

---

## F) ROL ADMIN — PARTICIPACIONES Y CALIFICACIÓN

### Tab: Participaciones
- [ ] Veo el reporte ordenado por fecha de creación de campaña (más recientes primero)
- [ ] Las columnas muestran: participante, tipo de cuenta, campaña, estado de participación, estado de campaña
- [ ] El filtro por nombre de campaña funciona
- [ ] El filtro por tipo de cuenta (Freemium/Premium) funciona
- [ ] El filtro por estado de participación funciona
- [ ] El filtro por estado de campaña funciona
- [ ] El filtro por deporte funciona
- [ ] El botón "Ver detalhes" abre el modal correctamente
- [ ] El modal muestra: fotos, videos, comentario del participante
- [ ] El modal muestra: fecha de registro en la plataforma
- [ ] El modal muestra: badge de Instagram (publicó ✅ / no publicó ❌)
- [ ] El modal muestra: estado de conclusión (CONCLUIDO / NO CONCLUIDO)
- [ ] El modal muestra: historial de campañas anteriores del participante

### Tab: Calificación
> **Fórmula:** TOTAL = (Compromiso + Continuidad) × Actitud | **Máximo: 9.5 pts**

- [ ] Solo aparecen participantes con: participación CONCLUIDO + campaña CONCLUIDO + usuario ACTIVO
- [ ] Las columnas muestran: participante, correo, deporte, campaña, mes de campaña, vencimiento
- [ ] El campo COMPROMISO (0–5) se calcula automáticamente — no editable manualmente
- [ ] El tooltip de Compromiso muestra el desglose de las 5 reglas (✅/❌ por regla)
- [ ] El campo CONTINUIDAD (0–5) se calcula automáticamente — no editable manualmente
- [ ] El tooltip de Continuidad muestra el desglose de las 5 reglas de historial (✅/❌ por regla)
- [ ] El campo ACTITUD (0.00–0.95) es editable manualmente por el admin
- [ ] El campo TOTAL se calcula en tiempo real al ingresar Actitud
- [ ] Si Actitud = 0, el total es 0 y el estado NO cambia a CALIFICADO
- [ ] Si Actitud > 0, el estado cambia automáticamente a CALIFICADO
- [ ] El botón "Detalles" abre el modal con galería lightbox de fotos y videos
- [ ] Las fotos y videos están en galerías separadas (no mezcladas)
- [ ] El visor lightbox permite ver fotos a pantalla completa sin distorsión
- [ ] El modal muestra el desglose educativo ✅/❌ de todas las reglas de calificación
- [ ] El botón "Marcar como ganador" cambia el estado de participación a GANADOR
- [ ] El participante GANADOR desaparece del Tab Calificación y aparece en Tab Ganadores

---

## G) ROL ADMIN — GANADORES Y REPORTE

### Tab: Ganadores
- [ ] Solo aparecen participantes con estado GANADOR
- [ ] Las columnas muestran: nombre del participante, campaña, mes de creación de campaña, premio
- [ ] El botón "Premio entregado" está disponible por fila
- [ ] Al hacer click en "Premio entregado", el estado visual del botón cambia (confirmación)

### Tab: Relatório
- [ ] Veo el reporte cruzado de todas las campañas
- [ ] Las columnas muestran: nombre, deporte, ciudad, plan, fechas, estado de participación, estado de premiación
- [ ] Los estados de premiación se muestran: PREMIADO o PENDENTE
- [ ] El filtro por estado de participación funciona
- [ ] El filtro por estado de premiación funciona
- [ ] El filtro por campaña funciona

---

## H) ESTADOS DEL SISTEMA — VERIFICACIÓN DE TRANSICIONES

### Transiciones de Estado de Participación

| Acción | Estado anterior | Estado nuevo | OK |
|---|---|---|---|
| Usuario hace click en "Participar" | — | EN CURSO | ☐ |
| Usuario sube evidencia (fotos/videos) | EN CURSO | CONCLUIDO | ☐ |
| Campaña cierra y usuario NO subió evidencia | EN CURSO | NO CONCLUIDO | ☐ |
| Admin ingresa Actitud > 0 | CONCLUIDO | CALIFICADO | ☐ |
| Admin hace click en "Marcar como ganador" | CALIFICADO | GANADOR | ☐ |

### Transiciones de Estado de Campaña

| Acción | Estado anterior | Estado nuevo | OK |
|---|---|---|---|
| Admin publica nueva campaña | — | ABIERTO | ☐ |
| Fecha de fin de campaña se cumple | ABIERTO | CONCLUIDO | ☐ |
| Admin elimina campaña | ABIERTO | ELIMINADO | ☐ |
| Todos los elegibles quedan calificados | CONCLUIDO | CALIFICADO | ☐ |

### Transiciones de Estado de Usuario

| Acción | Estado anterior | Estado nuevo | OK |
|---|---|---|---|
| Usuario se registra en la plataforma | — | ACTIVO | ☐ |
| Admin hace click en "Deshabilitar" | ACTIVO | DESHABILITADO | ☐ |

---

## I) NAVEGACIÓN Y FORMULARIOS

- [ ] Todos los tabs del menú de usuario funcionan: Campanhas, Minhas Participações, Notificações, Meu Perfil
- [ ] Todos los tabs del panel admin funcionan: Usuários, Campanhas, Participações, Calificación, Ganadores, Relatório, Deportes, Região Geográfica
- [ ] Los modales/ventanas emergentes se abren y cierran correctamente
- [ ] Los dropdowns de deporte y región muestran los datos de las tablas maestras
- [ ] Los campos requeridos muestran validación al intentar enviar vacíos
- [ ] Los mensajes de éxito y error aparecen correctamente
- [ ] El botón "atrás" del navegador funciona sin romper el estado
- [ ] No hay páginas de error 404 en rutas principales
- [ ] El diseño es responsive y se ve correctamente en móvil
- [ ] Todo el contenido está centrado (no alineado a la izquierda)

---

## J) CONSOLA Y BACKEND

- [ ] No hay errores críticos en la consola del navegador (F12)
- [ ] No hay warnings rojos importantes en consola
- [ ] Las requests HTTP responden con 200/201 (no 500/400)
- [ ] Los datos se guardan correctamente en Supabase / Mock API
- [ ] Los datos persisten al recargar la página
- [ ] Los estados se actualizan en tiempo real sin necesidad de recargar
- [ ] No hay errores en los logs del backend

---

## RESULTADO FINAL

- [ ] ✅ **PASA** — Puedo continuar al siguiente nivel de desarrollo
- [ ] ❌ **FALLA** — Debo corregir bugs críticos antes de continuar

### Bugs encontrados

1. **Auth Admin**: No se puede ingresar a `/admin` con credenciales por defecto (admin@3buk.com). El backend devuelve Error 400.
2. **Auth Usuario / Google btn**: El botón "Entrar com Google" no es visible en la página de login (solo aparece en la de registro).
3. **Auth Usuario / Error login**: Al ingresar contraseña incorrecta en login de rol usuario, la UI no muestra ningún mensaje de error visual (el error 400 solo aparece en consola).
4. **Admin UI / Nuevo Deporte o Región**: Posibles problemas menores de UX al no encontrar tan fácil "Regiões" si está oculto en scroll.
5. **Admin Campanhas / Date Picker**: Al tipear "01052026" el Datepicker generó el año 60501 en la UI en vez de parsearlo correctamente.
6. **User Minhas Participações**: El botón `Registrar participação` está activo (verde) inmediatamente, permitiendo enviar evidencias antes de que el Admin apruebe la participación.
7. _______________________________________________________________

### Notas adicionales

_______________________________________________________________

_______________________________________________________________

_______________________________________________________________

---

*3BUK Smoke Test v1.5 — #3bukchallenge*