const path = require("path");
const session = require("express-session");

const express = require("express");
const app = express();

const bcrypt = require("bcrypt");
const crypto = require("node:crypto");


const pool = require("./db");


const PORT = 3000;

app.use(express.json());

app.use(session({
    name: "ucn.sid",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        maxAge: 1000 * 60 * 60 * 2
    }
}));




function protegerPagina(rolPermitido) {
    return (req, res, next) => {

        if (!req.session?.usuario) {
            return res.redirect("/login.html");
        }

        if (req.session.usuario.rol !== rolPermitido) {
            return res.status(403).send(
                "Acceso denegado: no tienes permisos."
            );
        }

        next();
    };
}

// Proteger página del administrador
app.get(
    "/administrador.html",
    protegerPagina("administrador"),
    (req, res) => {
        res.sendFile(
            path.join(__dirname, "views", "administrador.html")
        );
    }
);

// Proteger página del organizador
app.get(
    "/organizador.html",
    protegerPagina("organizador"),
    (req, res) => {
        res.sendFile(
            path.join(__dirname, "views", "organizador.html")
        );
    }
);


app.use(express.static(
    path.join(__dirname, "public")
));


app.get("/", (req, res) => {
    res.sendFile(
        path.join(__dirname, "public", "index.html")
    );
});


// Ruta de prueba
app.get("/api/saludo", (req, res) => {
    res.json({
        mensaje: "Servidor Eventos UCN funcionando"
    });
});

app.get("/api/eventos", async (req, res) => {
    try {
        const resultado = await pool.query(`
            
SELECT
    e.id,
    e.titulo,
    e.descripcion,
    e.fecha_inicio,
    e.fecha_limite,
    e.lugar,
    e.cupo_maximo,
    e.estado,
    c.nombre AS categoria,
    COUNT(i.id)::INTEGER AS inscritos,
    (
        e.cupo_maximo - COUNT(i.id)
    )::INTEGER AS cupos_disponibles
FROM evento e
JOIN categoria c
    ON e.id_categoria = c.id
LEFT JOIN inscripcion i
    ON i.id_evento = e.id
    AND i.estado = 'activa'
WHERE e.estado = 'publicado'
GROUP BY e.id, c.id
ORDER BY e.fecha_inicio ASC

        `);

        res.json(resultado.rows);

    } catch (error) {
        console.error("Error al consultar eventos:", error);
        res.status(500).json({
            error: "No se pudieron obtener los eventos"
        });
    }
});

app.post("/api/login", async (req, res) => {
    const { correo, contrasena } = req.body;

    if (
        typeof correo !== "string" ||
        typeof contrasena !== "string" ||
        !correo.trim() ||
        !contrasena
    ) {
        return res.status(400).json({
            error: "Ingresa correo y contraseña"
        });
    }

    try {
        const resultado = await pool.query(
            `SELECT id, nombre, correo, rol, contrasena_hash
             FROM usuario WHERE correo = $1`,
            [correo.trim().toLowerCase()]
        );

        const usuario = resultado.rows[0];

        if (!usuario) {
            return res.status(401).json({
                error: "Credenciales incorrectas"
            });
        }

        // Las contraseñas del proyecto pueden utilizar
        // hashes bcrypt generados por PostgreSQL pgcrypto.
        const valido = await bcrypt.compare(
            contrasena,
            usuario.contrasena_hash
        );

        if (!valido) {
            return res.status(401).json({
                error: "Credenciales incorrectas"
            });
        }

        req.session.regenerate((error) => {
            if (error) {
                return res.status(500).json({
                    error: "No se pudo iniciar sesión"
                });
            }

            req.session.usuario = {
                id: usuario.id,
                nombre: usuario.nombre,
                rol: usuario.rol
            };

            req.session.save((error) => {
                if (error) {
                    return res.status(500).json({
                        error: "No se pudo guardar la sesión"
                    });
                }

                res.json({
                    mensaje: "Sesión iniciada",
                    usuario: req.session.usuario
                });
            });
        });

    } catch (error) {
        console.error("Error de autenticación:", error);
        res.status(500).json({
            error: "Error interno del servidor"
        });
    }
});


app.get("/api/usuario-actual", (req, res) => {
    if (!req.session.usuario) {
        return res.status(401).json({
            error: "No has iniciado sesión"
        });
    }

    res.json({
        usuario: req.session.usuario
    });
});

function verificarOrganizador(req, res, next) {
    if (!req.session.usuario) {
        return res.status(401).json({
            error: "Debes iniciar sesión"
        });
    }

    const rol = req.session.usuario.rol;

    if (rol !== "organizador" && rol !== "administrador") {
        return res.status(403).json({
            error: "No tienes permisos para esta operación"
        });
    }

    next();
}

app.post("/api/eventos", verificarOrganizador, async (req, res) => {
    const {
        titulo,
        descripcion,
        fecha_inicio,
        fecha_limite,
        lugar,
        cupo_maximo,
        id_categoria
    } = req.body;

    if (
        typeof titulo !== "string" ||
        !titulo.trim() ||
        typeof lugar !== "string" ||
        !lugar.trim() ||
        !fecha_inicio ||
        !fecha_limite ||
        !Number.isInteger(cupo_maximo) ||
        cupo_maximo <= 0 ||
        !Number.isInteger(id_categoria) ||
        id_categoria <= 0
    ) {
        return res.status(400).json({
            error: "Datos del evento incompletos o inválidos"
        });
    }

    const inicio = new Date(fecha_inicio);
    const limite = new Date(fecha_limite);

    if (
        !Number.isFinite(inicio.getTime()) ||
        !Number.isFinite(limite.getTime()) ||
        limite > inicio
    ) {
        return res.status(400).json({
            error: "Revisa las fechas del evento"
        });
    }

    try {
        const resultado = await pool.query(
            `INSERT INTO evento
            (titulo, descripcion, fecha_inicio,
             fecha_limite, lugar, cupo_maximo,
             estado, id_organizador, id_categoria)
            VALUES ($1, $2, $3, $4, $5, $6,
                    'borrador', $7, $8)
            RETURNING *`,
            [
                titulo.trim(),
                descripcion || "",
                fecha_inicio,
                fecha_limite,
                lugar.trim(),
                cupo_maximo,
                req.session.usuario.id,
                id_categoria
            ]
        );

        res.status(201).json({
            mensaje: "Evento creado como borrador",
            evento: resultado.rows[0]
        });

    } catch (error) {
        console.error("Error al crear evento:", error);

        res.status(500).json({
            error: "No se pudo crear el evento"
        });
    }
});

app.put("/api/eventos/:id", verificarOrganizador, async (req, res) => {
    const id = Number(req.params.id);
    const usuario = req.session.usuario;

    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({
            error: "ID de evento inválido"
        });
    }

    const {
        titulo,
        descripcion,
        fecha_inicio,
        fecha_limite,
        lugar,
        cupo_maximo,
        id_categoria
    } = req.body || {};

    if (
        typeof titulo !== "string" ||
        !titulo.trim() ||
        typeof descripcion !== "string" ||
        typeof lugar !== "string" ||
        !lugar.trim() ||
        typeof fecha_inicio !== "string" ||
        typeof fecha_limite !== "string" ||
        !Number.isInteger(cupo_maximo) ||
        cupo_maximo <= 0 ||
        !Number.isInteger(id_categoria) ||
        id_categoria <= 0 ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(fecha_inicio) ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(fecha_limite) ||
        fecha_limite > fecha_inicio
    ) {
        return res.status(400).json({
            error: "Revisa los datos y las fechas del evento"
        });
    }

    const cliente = await pool.connect();

    try {
        await cliente.query("BEGIN");

        const evento = await cliente.query(
            `SELECT id, estado, cupo_maximo
             FROM evento
             WHERE id = $1
               AND (id_organizador = $2 OR $3 = 'administrador')
             FOR UPDATE`,
            [id, usuario.id, usuario.rol]
        );

        if (evento.rowCount === 0) {
            await cliente.query("ROLLBACK");
            return res.status(404).json({
                error: "Evento no encontrado o no autorizado"
            });
        }

        if (evento.rows[0].estado === "cancelado") {
            await cliente.query("ROLLBACK");
            return res.status(409).json({
                error: "No puedes editar un evento cancelado"
            });
        }

        const conteo = await cliente.query(
            `SELECT COUNT(*)::int AS total
             FROM inscripcion
             WHERE id_evento = $1 AND estado = 'activa'`,
            [id]
        );

        if (cupo_maximo < conteo.rows[0].total) {
            await cliente.query("ROLLBACK");
            return res.status(409).json({
                error: "El cupo no puede ser menor que los inscritos activos"
            });
        }

        const resultado = await cliente.query(
            `UPDATE evento
             SET titulo = $1,
                 descripcion = $2,
                 fecha_inicio = $3,
                 fecha_limite = $4,
                 lugar = $5,
                 cupo_maximo = $6,
                 id_categoria = $7
             WHERE id = $8
             RETURNING id, titulo, estado`,
            [
                titulo.trim(),
                descripcion,
                fecha_inicio,
                fecha_limite,
                lugar.trim(),
                cupo_maximo,
                id_categoria,
                id
            ]
        );

        await cliente.query("COMMIT");

        res.json({
            mensaje: "Evento actualizado correctamente",
            evento: resultado.rows[0]
        });

    } catch (error) {
        await cliente.query("ROLLBACK");
        console.error("Error al editar evento:", error);

        res.status(500).json({
            error: "No se pudo actualizar el evento"
        });

    } finally {
        cliente.release();
    }
});

app.patch("/api/eventos/:id/cancelar",
    verificarOrganizador,
    async (req, res) => {

    const id = Number(req.params.id);
    const usuario = req.session.usuario;

    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({
            error: "ID inválido"
        });
    }

    try {
        const resultado = await pool.query(
            `UPDATE evento
             SET estado = 'cancelado'
             WHERE id = $1
               AND estado IN ('borrador', 'publicado')
               AND (
                   id_organizador = $2
                   OR $3 = 'administrador'
               )
             RETURNING id, titulo, estado`,
            [id, usuario.id, usuario.rol]
        );

        if (resultado.rowCount === 0) {
            return res.status(404).json({
                error: "Evento no encontrado, cancelado o no autorizado"
            });
        }

        res.json({
            mensaje: "Evento cancelado correctamente",
            evento: resultado.rows[0]
        });

    } catch (error) {
        console.error("Error al cancelar evento:", error);

        res.status(500).json({
            error: "No se pudo cancelar el evento"
        });
    }
});

app.get("/api/mis-eventos/:id",
    verificarOrganizador,
    async (req, res) => {

    const id = Number(req.params.id);
    const usuario = req.session.usuario;

    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({
            error: "ID inválido"
        });
    }

    try {
        const resultado = await pool.query(
            `SELECT id, titulo, descripcion,
                    fecha_inicio, fecha_limite,
                    lugar, cupo_maximo,
                    id_categoria, estado
             FROM evento
             WHERE id = $1
               AND (
                   id_organizador = $2
                   OR $3 = 'administrador'
               )`,
            [id, usuario.id, usuario.rol]
        );

        if (resultado.rowCount === 0) {
            return res.status(404).json({
                error: "Evento no encontrado"
            });
        }

        const evento = resultado.rows[0];

        // Formato local compatible con datetime-local.
        // Requiere que las fechas se hayan guardado
        // como horarios locales en PostgreSQL.
        const fechaLocal = (valor) => {
            const d = new Date(valor);
            const partes = new Intl.DateTimeFormat("sv-SE", {
                timeZone: "America/Santiago",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                hourCycle: "h23"
            }).formatToParts(d);

            const p = Object.fromEntries(
                partes.map(x => [x.type, x.value])
            );

            return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
        };

        evento.fecha_inicio = fechaLocal(evento.fecha_inicio);
        evento.fecha_limite = fechaLocal(evento.fecha_limite);

        res.json(evento);

    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: "No se pudo consultar el evento"
        });
    }
});


app.get("/api/categorias", async (req, res) => {
    try {
        const resultado = await pool.query(
            "SELECT id, nombre FROM categoria ORDER BY nombre"
        );

        res.json(resultado.rows);

    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: "No se pudieron cargar las categorías"
        });
    }
});

app.patch("/api/eventos/:id/publicar", verificarOrganizador, async (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({
            error: "ID de evento inválido"
        });
    }

    try {
        const usuario = req.session.usuario;

        const resultado = await pool.query(
            `UPDATE evento
             SET estado = 'publicado'
             WHERE id = $1
               AND estado = 'borrador'
               AND (
                   id_organizador = $2
                   OR $3 = 'administrador'
               )
             RETURNING id, titulo, estado`,
            [id, usuario.id, usuario.rol]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({
                error: "Evento no encontrado o no autorizado"
            });
        }

        res.json({
            mensaje: "Evento publicado correctamente",
            evento: resultado.rows[0]
        });

    } catch (error) {
        console.error("Error al publicar:", error);

        res.status(500).json({
            error: "No se pudo publicar el evento"
        });
    }
});

app.get("/api/mis-eventos", verificarOrganizador, async (req, res) => {
    try {
        const usuario = req.session.usuario;

        const resultado = await pool.query(
            `SELECT id, titulo, fecha_inicio, lugar,
                    cupo_maximo, estado
             FROM evento
             WHERE id_organizador = $1
                OR $2 = 'administrador'
             ORDER BY fecha_inicio`,
            [usuario.id, usuario.rol]
        );

        res.json(resultado.rows);

    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: "No se pudieron consultar los eventos"
        });
    }
});

app.post("/api/cambiar-clave", async (req, res) => {

    // Comprobar la sesión
    if (!req.session?.usuario?.id) {
        return res.status(401).json({
            error: "Debes iniciar sesión"
        });
    }

    // Comprobar el origen de la solicitud
    if (req.get("origin") !==
        `${req.protocol}://${req.get("host")}`) {
        return res.status(403).json({
            error: "Solicitud no autorizada"
        });
    }

    const {
        claveActual,
        claveNueva,
        confirmarClave
    } = req.body || {};

    if (
        typeof claveActual !== "string" ||
        typeof claveNueva !== "string" ||
        typeof confirmarClave !== "string"
    ) {
        return res.status(400).json({
            error: "Debes completar todos los campos"
        });
    }

    if (claveNueva !== confirmarClave) {
        return res.status(400).json({
            error: "Las contraseñas no coinciden"
        });
    }

    if (
        claveNueva.length < 6 ||
        Buffer.byteLength(claveNueva, "utf8") > 72
    ) {
        return res.status(400).json({
            error: "La nueva contraseña debe tener al menos 6 caracteres y no superar 72 bytes"
        });
    }

    if (claveNueva === claveActual) {
        return res.status(400).json({
            error: "La nueva contraseña debe ser diferente"
        });
    }

    try {
        const idUsuario = req.session.usuario.id;

        // Consultar el hash de la contraseña
        const resultado = await pool.query(
            `SELECT contrasena_hash
             FROM usuario
             WHERE id = $1`,
            [idUsuario]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({
                error: "Usuario no encontrado"
            });
        }

        const hashActual =
            resultado.rows[0].contrasena_hash;

        // Verificar contraseña actual
        const esCorrecta = await bcrypt.compare(
            claveActual,
            hashActual
        );

        if (!esCorrecta) {
            return res.status(401).json({
                error: "La contraseña actual es incorrecta"
            });
        }

        // Evitar reutilizar contraseña
        const esIgual = await bcrypt.compare(
            claveNueva,
            hashActual
        );

        if (esIgual) {
            return res.status(400).json({
                error: "Debes usar una contraseña diferente"
            });
        }

        // Generar hash bcrypt
        const nuevoHash = await bcrypt.hash(
            claveNueva,
            12
        );

        // Actualizar contraseña en PostgreSQL
        const actualizacion = await pool.query(
            `UPDATE usuario
             SET contrasena_hash = $1
             WHERE id = $2
               AND contrasena_hash = $3
             RETURNING id`,
            [nuevoHash, idUsuario, hashActual]
        );

        if (actualizacion.rowCount === 0) {
            return res.status(409).json({
                error: "La contraseña fue modificada. Intenta nuevamente."
            });
        }

        res.json({
            mensaje: "Contraseña actualizada correctamente"
        });

    } catch (error) {
        console.error("Error al cambiar contraseña:", error);

        res.status(500).json({
            error: "Error interno del servidor"
        });
    }
});

app.post("/api/logout", (req, res) => {
    if (!req.session) {
        return res.status(401).json({
            error: "No hay sesión activa"
        });
    }

    req.session.destroy((error) => {
        if (error) {
            return res.status(500).json({
                error: "No se pudo cerrar sesión"
            });
        }

        res.clearCookie("ucn.sid");
        res.json({
            mensaje: "Sesión cerrada correctamente"
        });
    });
});

app.post("/api/registro", async (req, res) => {
    const {
        nombre,
        correo,
        contrasena,
        confirmar
    } = req.body || {};

    // Validar los datos recibidos
    if (
        typeof nombre !== "string" ||
        typeof correo !== "string" ||
        typeof contrasena !== "string" ||
        typeof confirmar !== "string"
    ) {
        return res.status(400).json({
            error: "Debes completar todos los campos"
        });
    }

    const nombreLimpio = nombre.trim();
    const correoLimpio = correo.trim().toLowerCase();

    if (
        nombreLimpio.length === 0 ||
        nombreLimpio.length > 100 ||
        correoLimpio.length > 150 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoLimpio)
    ) {
        return res.status(400).json({
            error: "Nombre o correo inválido"
        });
    }

    if (
        contrasena.length < 6 ||
        Buffer.byteLength(contrasena, "utf8") > 72
    ) {
        return res.status(400).json({
            error: "La contraseña debe tener mínimo 6 caracteres y no superar 72 bytes"
        });
    }

    if (contrasena !== confirmar) {
        return res.status(400).json({
            error: "Las contraseñas no coinciden"
        });
    }

    try {
        // Cifrar la contraseña mediante hash bcrypt
        const hash = await bcrypt.hash(contrasena, 12);

        const resultado = await pool.query(
            `INSERT INTO usuario
             (nombre, correo, contrasena_hash, rol)
             VALUES ($1, $2, $3, 'participante')
             RETURNING id, nombre, correo, rol`,
            [nombreLimpio, correoLimpio, hash]
        );

        return res.status(201).json({
            mensaje: "Cuenta creada correctamente",
            usuario: resultado.rows[0]
        });

    } catch (error) {
        if (error.code === "23505") {
            return res.status(409).json({
                error: "Este correo ya está registrado"
            });
        }

        console.error("Error de registro:", error);

        return res.status(500).json({
            error: "No se pudo crear la cuenta"
        });
    }
});

function verificarParticipante(req, res, next) {
    if (!req.session?.usuario) {
        return res.status(401).json({
            error: "Debes iniciar sesión para inscribirte"
        });
    }

    if (req.session.usuario.rol !== "participante") {
        return res.status(403).json({
            error: "Solo los participantes pueden inscribirse"
        });
    }

    next();
}

app.post("/api/inscripciones", verificarParticipante, async (req, res) => {
    const idEvento = Number(req.body?.id_evento);
    const idUsuario = req.session.usuario.id;

    if (!Number.isInteger(idEvento) || idEvento <= 0) {
        return res.status(400).json({
            error: "Evento inválido"
        });
    }

    const cliente = await pool.connect();

    try {
        await cliente.query("BEGIN");

        // Bloquear el evento para evitar sobreinscripciones
        const consultaEvento = await cliente.query(
            `SELECT id, titulo, cupo_maximo, estado,
                    fecha_limite, fecha_inicio
             FROM evento
             WHERE id = $1
             FOR UPDATE`,
            [idEvento]
        );

        if (consultaEvento.rows.length === 0) {
            await cliente.query("ROLLBACK");
            return res.status(404).json({
                error: "Evento no encontrado"
            });
        }

        const evento = consultaEvento.rows[0];

        if (
            evento.estado !== "publicado" ||
            new Date(evento.fecha_limite) < new Date() ||
            new Date(evento.fecha_inicio) <= new Date()
        ) {
            await cliente.query("ROLLBACK");
            return res.status(400).json({
                error: "Este evento no acepta inscripciones"
            });
        }

        // Revisar inscripción previa
        const anterior = await cliente.query(
            `SELECT id, estado
             FROM inscripcion
             WHERE id_usuario = $1 AND id_evento = $2`,
            [idUsuario, idEvento]
        );

        if (
            anterior.rows.length > 0 &&
            anterior.rows[0].estado === "activa"
        ) {
            await cliente.query("ROLLBACK");
            return res.status(409).json({
                error: "Ya estás inscrito en este evento"
            });
        }

        // Contar inscripciones activas
        const conteo = await cliente.query(
            `SELECT COUNT(*)::int AS total
             FROM inscripcion
             WHERE id_evento = $1 AND estado = 'activa'`,
            [idEvento]
        );

        if (conteo.rows[0].total >= evento.cupo_maximo) {
            await cliente.query("ROLLBACK");
            return res.status(409).json({
                error: "No quedan cupos disponibles"
            });
        }

        if (anterior.rows.length > 0) {
            // Reactivar inscripción cancelada
            await cliente.query(
                `UPDATE inscripcion
                 SET estado = 'activa',
                     fecha_registro = CURRENT_TIMESTAMP,
                     asistio = FALSE
                 WHERE id = $1`,
                [anterior.rows[0].id]
            );
        } else {
            await cliente.query(
                `INSERT INTO inscripcion
                 (id_usuario, id_evento)
                 VALUES ($1, $2)`,
                [idUsuario, idEvento]
            );
        }

        await cliente.query("COMMIT");

        return res.status(201).json({
            mensaje: "Inscripción realizada correctamente"
        });

    } catch (error) {
        await cliente.query("ROLLBACK");
        console.error("Error de inscripción:", error);
        return res.status(500).json({
            error: "No se pudo realizar la inscripción"
        });

    } finally {
        cliente.release();
    }
});

app.get("/api/mis-inscripciones", verificarParticipante, async (req, res) => {
    try {
        const idUsuario = req.session.usuario.id;

        const resultado = await pool.query(
            `SELECT
                i.id,
                i.estado,
                i.fecha_registro,
                i.asistio,
                e.id AS id_evento,
                e.titulo,
                e.fecha_inicio,
                e.fecha_limite,
                e.lugar,
                c.nombre AS categoria
             FROM inscripcion i
             JOIN evento e ON i.id_evento = e.id
             JOIN categoria c ON e.id_categoria = c.id
             WHERE i.id_usuario = $1
             ORDER BY e.fecha_inicio`,
            [idUsuario]
        );

        res.json(resultado.rows);

    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: "No se pudieron obtener las inscripciones"
        });
    }
});

app.patch("/api/inscripciones/:id/cancelar",
    verificarParticipante,
    async (req, res) => {

    const id = Number(req.params.id);
    const idUsuario = req.session.usuario.id;

    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({
            error: "Inscripción inválida"
        });
    }

    const cliente = await pool.connect();

    try {
        await cliente.query("BEGIN");

        // Bloquear primero el evento, igual que al inscribirse
        const evento = await cliente.query(
            `SELECT e.id, e.fecha_limite
             FROM evento e
             JOIN inscripcion i ON i.id_evento = e.id
             WHERE i.id = $1 AND i.id_usuario = $2
             FOR UPDATE OF e`,
            [id, idUsuario]
        );

        if (evento.rows.length === 0) {
            await cliente.query("ROLLBACK");
            return res.status(404).json({
                error: "Inscripción no encontrada"
            });
        }

        const resultado = await cliente.query(
            `UPDATE inscripcion
             SET estado = 'cancelada'
             WHERE id = $1
               AND id_usuario = $2
               AND estado = 'activa'
               AND CURRENT_TIMESTAMP <= $3
             RETURNING id`,
            [id, idUsuario, evento.rows[0].fecha_limite]
        );

        if (resultado.rowCount === 0) {
            await cliente.query("ROLLBACK");
            return res.status(400).json({
                error: "Inscripción cancelada o fuera de plazo"
            });
        }

        await cliente.query("COMMIT");

        res.json({
            mensaje: "Inscripción cancelada correctamente"
        });

    } catch (error) {
        await cliente.query("ROLLBACK");
        console.error(error);
        res.status(500).json({
            error: "No se pudo cancelar la inscripción"
        });

    } finally {
        cliente.release();
    }
});

app.get("/api/eventos/:id/inscritos",
    verificarOrganizador,
    async (req, res) => {

    const idEvento = Number(req.params.id);
    const usuario = req.session.usuario;

    if (!Number.isInteger(idEvento) || idEvento <= 0) {
        return res.status(400).json({
            error: "Evento inválido"
        });
    }

    try {
        const resultado = await pool.query(
            `SELECT
                i.id AS id_inscripcion,
                u.nombre,
                u.correo,
                i.fecha_registro,
                i.asistio
             FROM inscripcion i
             JOIN usuario u ON u.id = i.id_usuario
             JOIN evento e ON e.id = i.id_evento
             WHERE e.id = $1
               AND i.estado = 'activa'
               AND (
                   e.id_organizador = $2
                   OR $3 = 'administrador'
               )
             ORDER BY u.nombre`,
            [idEvento, usuario.id, usuario.rol]
        );

        res.json(resultado.rows);

    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: "No se pudieron consultar los inscritos"
        });
    }
});

app.patch("/api/inscripciones/:id/asistencia",
    verificarOrganizador,
    async (req, res) => {

    const idInscripcion = Number(req.params.id);
    const { asistio } = req.body || {};
    const usuario = req.session.usuario;

    if (
        !Number.isInteger(idInscripcion) ||
        idInscripcion <= 0 ||
        typeof asistio !== "boolean"
    ) {
        return res.status(400).json({
            error: "Datos inválidos"
        });
    }

    try {
        const resultado = await pool.query(
            `UPDATE inscripcion i
             SET asistio = $1
             FROM evento e
             WHERE i.id = $2
               AND i.id_evento = e.id
               AND i.estado = 'activa'
               AND (
                   e.id_organizador = $3
                   OR $4 = 'administrador'
               )
             RETURNING i.id, i.asistio`,
            [asistio, idInscripcion, usuario.id, usuario.rol]
        );

        if (resultado.rowCount === 0) {
            return res.status(404).json({
                error: "Inscripción no encontrada o no autorizada"
            });
        }

        res.json({
            mensaje: "Asistencia actualizada correctamente",
            inscripcion: resultado.rows[0]
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: "No se pudo registrar la asistencia"
        });
    }
});

function verificarAdministrador(req, res, next) {
    if (!req.session?.usuario) {
        return res.status(401).json({
            error: "Debes iniciar sesión"
        });
    }

    if (req.session.usuario.rol !== "administrador") {
        return res.status(403).json({
            error: "Acceso exclusivo para administradores"
        });
    }

    next();
}

app.post("/api/admin/categorias",
    verificarAdministrador,
    async (req, res) => {

    const { nombre } = req.body || {};

    // Validar el nombre de la categoría
    if (
        typeof nombre !== "string" ||
        nombre.trim().length < 3 ||
        nombre.trim().length > 100
    ) {
        return res.status(400).json({
            error: "La categoría debe tener entre 3 y 100 caracteres"
        });
    }

    const nombreLimpio = nombre.trim();

    try {
        // Comprobar si existe la categoría
        const existente = await pool.query(
            `SELECT id
             FROM categoria
             WHERE LOWER(nombre) = LOWER($1)`,
            [nombreLimpio]
        );

        if (existente.rows.length > 0) {
            return res.status(409).json({
                error: "Esta categoría ya existe"
            });
        }

        // Crear nueva categoría
        const resultado = await pool.query(
            `INSERT INTO categoria (nombre)
             VALUES ($1)
             RETURNING id, nombre`,
            [nombreLimpio]
        );

        return res.status(201).json({
            mensaje: "Categoría creada correctamente",
            categoria: resultado.rows[0]
        });

    } catch (error) {
        console.error("Error al crear categoría:", error);

        if (error.code === "23505") {
            return res.status(409).json({
                error: "Esta categoría ya existe"
            });
        }

        return res.status(500).json({
            error: "No se pudo crear la categoría"
        });
    }
});

app.patch("/api/admin/categorias/:id",
    verificarAdministrador,
    async (req, res) => {

    const id = Number(req.params.id);
    const { nombre } = req.body || {};

    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({
            error: "ID de categoría inválido"
        });
    }

    if (
        typeof nombre !== "string" ||
        nombre.trim().length < 3 ||
        nombre.trim().length > 100
    ) {
        return res.status(400).json({
            error: "El nombre debe tener entre 3 y 100 caracteres"
        });
    }

    const nombreLimpio = nombre.trim();

    try {
        const resultado = await pool.query(
            `UPDATE categoria
             SET nombre = $1
             WHERE id = $2
               AND NOT EXISTS (
                   SELECT 1
                   FROM categoria
                   WHERE LOWER(nombre) = LOWER($1)
                     AND id <> $2
               )
             RETURNING id, nombre`,
            [nombreLimpio, id]
        );

        if (resultado.rowCount === 0) {
            return res.status(409).json({
                error: "Categoría no encontrada o nombre duplicado"
            });
        }

        res.json({
            mensaje: "Categoría actualizada correctamente",
            categoria: resultado.rows[0]
        });

    } catch (error) {
        console.error("Error al editar categoría:", error);

        if (error.code === "23505") {
            return res.status(409).json({
                error: "Ya existe una categoría con ese nombre"
            });
        }

        res.status(500).json({
            error: "No se pudo actualizar la categoría"
        });
    }
});

app.get("/api/admin/usuarios", verificarAdministrador,
    async (req, res) => {
        try {
            const resultado = await pool.query(
                `SELECT id, nombre, correo, rol
                 FROM usuario
                 ORDER BY id`
            );

            res.json(resultado.rows);
        } catch (error) {
            console.error(error);
            res.status(500).json({
                error: "No se pudieron consultar los usuarios"
            });
        }
    }
);

app.get("/api/admin/eventos", verificarAdministrador,
    async (req, res) => {
        try {
            const resultado = await pool.query(
                `SELECT e.id, e.titulo, e.estado,
                        e.fecha_inicio, e.cupo_maximo,
                        c.nombre AS categoria,
                        u.nombre AS organizador
                 FROM evento e
                 JOIN categoria c ON c.id = e.id_categoria
                 JOIN usuario u ON u.id = e.id_organizador
                 ORDER BY e.fecha_inicio DESC`
            );

            res.json(resultado.rows);
        } catch (error) {
            console.error(error);
            res.status(500).json({
                error: "No se pudieron consultar los eventos"
            });
        }
    }
);

app.get("/api/admin/estadisticas", verificarAdministrador,
    async (req, res) => {
        try {
            const resultado = await pool.query(`
                SELECT
                    (SELECT COUNT(*)::int FROM usuario)
                        AS usuarios,
                    (SELECT COUNT(*)::int FROM evento)
                        AS eventos,
                    (SELECT COUNT(*)::int
                     FROM inscripcion
                     WHERE estado = 'activa')
                        AS inscripciones_activas,
                    (SELECT COUNT(*)::int
                     FROM inscripcion
                     WHERE estado = 'activa'
                       AND asistio = TRUE)
                        AS asistencias
            `);

            res.json(resultado.rows[0]);
        } catch (error) {
            console.error(error);
            res.status(500).json({
                error: "No se pudieron obtener las estadísticas"
            });
        }
    }
);

app.patch("/api/admin/usuarios/:id/rol",
    verificarAdministrador,
    async (req, res) => {

    const idUsuario = Number(req.params.id);
    const { rol } = req.body || {};
    const idAdministrador = req.session.usuario.id;

    const rolesPermitidos = [
        "participante",
        "organizador",
        "administrador"
    ];

    if (!Number.isInteger(idUsuario) || idUsuario <= 0) {
        return res.status(400).json({
            error: "ID de usuario inválido"
        });
    }

    if (!rolesPermitidos.includes(rol)) {
        return res.status(400).json({
            error: "Rol no permitido"
        });
    }

    // Evitar que el administrador cambie su propio rol
    if (idUsuario === idAdministrador) {
        return res.status(403).json({
            error: "No puedes modificar tu propio rol"
        });
    }

    try {
        const resultado = await pool.query(
            `UPDATE usuario
             SET rol = $1
             WHERE id = $2
             RETURNING id, nombre, correo, rol`,
            [rol, idUsuario]
        );

        if (resultado.rowCount === 0) {
            return res.status(404).json({
                error: "Usuario no encontrado"
            });
        }

        res.json({
            mensaje: "Rol actualizado correctamente",
            usuario: resultado.rows[0]
        });

    } catch (error) {
        console.error("Error al modificar rol:", error);

        res.status(500).json({
            error: "No se pudo modificar el rol"
        });
    }
});


app.get("/api/admin/estadisticas-eventos",
    verificarAdministrador,
    async (req, res) => {

    try {
        const resultado = await pool.query(`
            SELECT
                e.id,
                e.titulo,
                e.estado,
                e.cupo_maximo,
                c.nombre AS categoria,

                COUNT(i.id) FILTER (
                    WHERE i.estado = 'activa'
                )::INTEGER AS inscritos,

                COUNT(i.id) FILTER (
                    WHERE i.estado = 'activa'
                    AND i.asistio = TRUE
                )::INTEGER AS asistentes,

                GREATEST(
                    e.cupo_maximo -
                    COUNT(i.id) FILTER (
                        WHERE i.estado = 'activa'
                    ),
                    0
                )::INTEGER AS disponibles

            FROM evento e
            JOIN categoria c ON c.id = e.id_categoria
            LEFT JOIN inscripcion i
                ON i.id_evento = e.id

            GROUP BY
                e.id,
                e.titulo,
                e.estado,
                e.cupo_maximo,
                c.nombre

            ORDER BY e.id;
        `);

        res.json(resultado.rows);

    } catch (error) {
        console.error("Error en estadísticas:", error);

        res.status(500).json({
            error: "No se pudieron consultar las estadísticas"
        });
    }
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(
        `Servidor funcionando en http://localhost:${PORT}`
    );
});

