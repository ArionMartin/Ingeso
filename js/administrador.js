
const bienvenida = document.getElementById("bienvenida");
const contenido = document.getElementById("contenidoAdmin");
const mensaje = document.getElementById("mensajeAdmin");

async function solicitarJSON(url) {
    const respuesta = await fetch(url, {
        credentials: "same-origin",
        cache: "no-store"
    });

    if (!respuesta.ok) {
        throw new Error(`Error al consultar ${url}`);
    }

    return respuesta.json();
}

function mostrarTabla(contenedorId, columnas, registros) {
    const contenedor = document.getElementById(contenedorId);
    contenedor.replaceChildren();

    if (registros.length === 0) {
        contenedor.textContent = "No hay registros.";
        return;
    }

    const envoltura = document.createElement("div");
    envoltura.className = "tabla-responsive";

    const tabla = document.createElement("table");
    const cabecera = document.createElement("thead");
    const filaCabecera = document.createElement("tr");

    columnas.forEach(columna => {
        const th = document.createElement("th");
        th.textContent = columna.titulo;
        filaCabecera.appendChild(th);
    });

    cabecera.appendChild(filaCabecera);

    const cuerpo = document.createElement("tbody");

    registros.forEach(registro => {
        const fila = document.createElement("tr");

        columnas.forEach(columna => {
            const celda = document.createElement("td");

            celda.textContent =
                String(registro[columna.campo] ?? "—");

            fila.appendChild(celda);
        });

        cuerpo.appendChild(fila);
    });

    tabla.append(cabecera, cuerpo);
    envoltura.appendChild(tabla);
    contenedor.appendChild(envoltura);
}

async function iniciarAdministrador() {
    try {
        const sesion = await fetch("/api/usuario-actual", {
            credentials: "same-origin",
            cache: "no-store"
        });

        if (sesion.status === 401) {
            window.location.replace("/login.html");
            return;
        }

        if (!sesion.ok) {
            throw new Error("No se pudo verificar la sesión");
        }

        const datos = await sesion.json();
        const usuario = datos.usuario;

        if (usuario.rol !== "administrador") {
            bienvenida.textContent = "Acceso no autorizado.";
            return;
        }

        bienvenida.textContent = `Bienvenido, ${usuario.nombre}`;
        contenido.hidden = false;

        await cargarDatos();

    } catch (error) {
        mensaje.textContent = error.message;
    }
}

async function cargarDatos() {
    try {
        const [estadisticas, usuarios, eventos, categorias] =
            await Promise.all([
                solicitarJSON("/api/admin/estadisticas"),
                solicitarJSON("/api/admin/usuarios"),
                solicitarJSON("/api/admin/eventos"),
                solicitarJSON("/api/categorias")
            ]);

        document.getElementById("totalUsuarios").textContent =
            estadisticas.usuarios;

        document.getElementById("totalEventos").textContent =
            estadisticas.eventos;

        document.getElementById("totalInscripciones").textContent =
            estadisticas.inscripciones_activas;

        document.getElementById("totalAsistencias").textContent =
            estadisticas.asistencias;

        mostrarTabla("listaUsuarios", [
            { titulo: "ID", campo: "id" },
            { titulo: "Nombre", campo: "nombre" },
            { titulo: "Correo", campo: "correo" },
            { titulo: "Rol", campo: "rol" }
        ], usuarios);

        mostrarTabla("listaEventos", [
            { titulo: "ID", campo: "id" },
            { titulo: "Evento", campo: "titulo" },
            { titulo: "Categoría", campo: "categoria" },
            { titulo: "Organizador", campo: "organizador" },
            { titulo: "Estado", campo: "estado" }
        ], eventos);

        mostrarTabla("listaCategorias", [
            { titulo: "ID", campo: "id" },
            { titulo: "Categoría", campo: "nombre" }
        ], categorias);

    } catch (error) {
        mensaje.textContent = error.message;
    }
}

document.getElementById("cerrarSesion")
    .addEventListener("click", async () => {
        try {
            const respuesta = await fetch("/api/logout", {
                method: "POST",
                credentials: "same-origin"
            });

            if (!respuesta.ok) {
                throw new Error("No se pudo cerrar sesión");
            }

            window.location.replace("/login.html");

        } catch (error) {
            mensaje.textContent = error.message;
        }
    });

iniciarAdministrador();
