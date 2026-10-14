
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

agregarAccionesUsuarios(usuarios);


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

function agregarAccionesUsuarios(usuarios) {
    const tabla = document.querySelector(
        "#listaUsuarios table"
    );

    if (!tabla) return;

    const encabezado = tabla.querySelector("thead tr");
    const columna = document.createElement("th");
    columna.textContent = "Acciones";
    encabezado.appendChild(columna);

    const filas = tabla.querySelectorAll("tbody tr");

    filas.forEach((fila, indice) => {
        const usuario = usuarios[indice];

        const celda = document.createElement("td");
        const selector = document.createElement("select");

        ["participante", "organizador", "administrador"]
            .forEach(rol => {
                selector.add(new Option(rol, rol));
            });

        selector.value = usuario.rol;

        const boton = document.createElement("button");
        boton.type = "button";
        boton.textContent = "Guardar";
        boton.className = "btn-guardar-rol";

        // El administrador no cambia su propio rol
        if (usuario.rol === "administrador") {
            selector.disabled = true;
            boton.disabled = true;
        }

        boton.addEventListener("click", async () => {
            if (selector.value === usuario.rol) return;

            const confirmado = confirm(
                `¿Cambiar el rol de ${usuario.nombre} a ${selector.value}?`
            );

            if (!confirmado) {
                selector.value = usuario.rol;
                return;
            }

            boton.disabled = true;

            try {
                const respuesta = await fetch(
                    `/api/admin/usuarios/${usuario.id}/rol`,
                    {
                        method: "PATCH",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            rol: selector.value
                        })
                    }
                );

                const datos = await respuesta.json();

                if (!respuesta.ok) {
                    throw new Error(datos.error);
                }

                alert("Rol actualizado correctamente");
                await cargarDatos();

            } catch (error) {
                alert(error.message);
                selector.value = usuario.rol;
                boton.disabled = false;
            }
        });

        celda.append(selector, boton);
        fila.appendChild(celda);
    });
}

const formCategoria =
    document.getElementById("formCategoria");

const mensajeCategoria =
    document.getElementById("mensajeCategoria");

formCategoria.addEventListener("submit", async (event) => {
    event.preventDefault();

    const nombre =
        document.getElementById("nombreCategoria").value.trim();

    const boton =
        document.getElementById("guardarCategoria");

    boton.disabled = true;
    mensajeCategoria.textContent = "Guardando categoría...";

    try {
        const respuesta = await fetch("/api/admin/categorias", {
            method: "POST",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ nombre })
        });

        const datos = await respuesta.json();

        if (!respuesta.ok) {
            throw new Error(
                datos.error || "No se pudo crear la categoría"
            );
        }

        mensajeCategoria.style.color = "green";
        mensajeCategoria.textContent =
            "Categoría creada correctamente";

        formCategoria.reset();

        // Actualizar la tabla sin recargar la página
        await cargarDatos();

    } catch (error) {
        mensajeCategoria.style.color = "#b42318";
        mensajeCategoria.textContent = error.message;

    } finally {
        boton.disabled = false;
    }
});
