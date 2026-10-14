
const formulario = document.getElementById("formEvento");
const mensaje = document.getElementById("mensaje");
const bienvenida = document.getElementById("bienvenida");
const selector = document.getElementById("id_categoria");

let eventoEnEdicion = null;

async function iniciarPanel() {
    try {
        const respuesta = await fetch("/api/usuario-actual");

        if (!respuesta.ok) {
            window.location.replace("/login.html");
            return;
        }

        const datos = await respuesta.json();
        const usuario = datos.usuario;

        if (!["organizador", "administrador"].includes(usuario.rol)) {
            bienvenida.textContent = "Acceso no autorizado";
            formulario.hidden = true;
            return;
        }

        bienvenida.textContent = `Bienvenido, ${usuario.nombre}`;

        const respuestaCategorias = await fetch("/api/categorias");

        if (!respuestaCategorias.ok) {
            throw new Error("No se pudieron cargar las categorías");
        }

        const categorias = await respuestaCategorias.json();

        categorias.forEach(categoria => {
            selector.add(
                new Option(categoria.nombre, categoria.id)
            );
        });

    } catch (error) {
        mensaje.textContent = error.message;
    }
}

formulario.addEventListener("submit", async (event) => {
    event.preventDefault();

    const inicio = document.getElementById("fecha_inicio").value;
    const limite = document.getElementById("fecha_limite").value;

    if (limite > inicio) {
        mensaje.textContent =
            "La inscripción debe cerrar antes del evento.";
        return;
    }

    const datos = {
        titulo: document.getElementById("titulo").value,
        descripcion: document.getElementById("descripcion").value,
        fecha_inicio: inicio,
        fecha_limite: limite,
        lugar: document.getElementById("lugar").value,
        cupo_maximo: Number(
            document.getElementById("cupo_maximo").value
        ),
        id_categoria: Number(selector.value)
    };

    try {
        
const url = eventoEnEdicion
    ? `/api/eventos/${eventoEnEdicion}`
    : "/api/eventos";

const metodo = eventoEnEdicion ? "PUT" : "POST";

const respuesta = await fetch(url, {
    method: metodo,
    headers: {
        "Content-Type": "application/json"
    },
    body: JSON.stringify(datos)
});

const resultado = await respuesta.json();

if (!respuesta.ok) {
    throw new Error(
        resultado.error || "No se pudo guardar el evento"
    );
}

mensaje.textContent = resultado.mensaje;

salirEdicion();
await cargarMisEventos();


        if (!respuesta.ok) {
            throw new Error(
                resultado.error || "No se pudo crear el evento"
            );
        }

        mensaje.textContent = "Evento creado correctamente como borrador.";
        formulario.reset();
        await cargarMisEventos();

    } catch (error) {
        mensaje.textContent = error.message;
    }
});

iniciarPanel();

async function cargarMisEventos() {
    const contenedor = document.getElementById("misEventos");

    try {
        const respuesta = await fetch("/api/mis-eventos");

        if (!respuesta.ok) {
            throw new Error("No se pudieron cargar los eventos");
        }

        const eventos = await respuesta.json();
        contenedor.replaceChildren();

        if (eventos.length === 0) {
            contenedor.textContent = "Todavía no tienes eventos.";
            return;
        }

        eventos.forEach(evento => {
            const tarjeta = document.createElement("div");
            tarjeta.className = "evento-admin";

            const titulo = document.createElement("h4");
            titulo.textContent = evento.titulo;

            const estado = document.createElement("p");
            estado.textContent = `Estado: ${evento.estado}`;

            tarjeta.append(titulo, estado);
            
if (evento.estado !== "cancelado") {

    // Botón Editar
    const botonEditar = document.createElement("button");
    botonEditar.type = "button";
    botonEditar.textContent = "Editar";

    botonEditar.addEventListener("click", () => {
        editarEvento(evento.id);
    });

    // Botón Cancelar evento
    const botonCancelar = document.createElement("button");
    botonCancelar.type = "button";
    botonCancelar.textContent = "Cancelar evento";
    botonCancelar.className = "btn-cancelar-evento";

    botonCancelar.addEventListener("click", async () => {
        const confirmar = window.confirm(
            `¿Seguro que deseas cancelar "${evento.titulo}"?`
        );

        if (!confirmar) return;

        botonCancelar.disabled = true;

        try {
            const respuesta = await fetch(
                `/api/eventos/${evento.id}/cancelar`,
                { method: "PATCH" }
            );

            const datos = await respuesta.json();

            if (!respuesta.ok) {
                throw new Error(
                    datos.error || "No se pudo cancelar"
                );
            }

            alert("Evento cancelado correctamente.");
            await cargarMisEventos();

        } catch (error) {
            alert(error.message);
            botonCancelar.disabled = false;
        }
    });

    tarjeta.append(botonEditar, botonCancelar);
}


            if (evento.estado === "borrador") {
                const boton = document.createElement("button");
                boton.type = "button";
                boton.textContent = "Publicar";

                boton.addEventListener("click", async () => {
                    boton.disabled = true;

                    try {
                        const respuesta = await fetch(
                            `/api/eventos/${evento.id}/publicar`,
                            { method: "PATCH" }
                        );

                        const datos = await respuesta.json();

                        if (!respuesta.ok) {
                            throw new Error(datos.error);
                        }

                        await cargarMisEventos();

                    } catch (error) {
                        alert(error.message);
                        boton.disabled = false;
                    }
                });

                tarjeta.appendChild(boton);
            }

            contenedor.appendChild(tarjeta);
        });

    } catch (error) {
        contenedor.textContent = error.message;
    }
}

cargarMisEventos();

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
            alert(error.message);
        }
    });

const selectorAsistencia =
    document.getElementById("eventoAsistencia");

const listaAsistencia =
    document.getElementById("listaAsistencia");

async function cargarEventosAsistencia() {
    try {
        const respuesta = await fetch("/api/mis-eventos");

        if (!respuesta.ok) {
            throw new Error("No se pudieron cargar los eventos");
        }

        const eventos = await respuesta.json();

        selectorAsistencia.replaceChildren(
            new Option("Seleccione un evento", "")
        );

        eventos.forEach(evento => {
            selectorAsistencia.add(
                new Option(evento.titulo, evento.id)
            );
        });

    } catch (error) {
        listaAsistencia.textContent = error.message;
    }
}

async function cargarInscritos() {
    const idEvento = selectorAsistencia.value;

    listaAsistencia.replaceChildren();

    if (!idEvento) {
        listaAsistencia.textContent =
            "Selecciona un evento.";
        return;
    }

    try {
        const respuesta = await fetch(
            `/api/eventos/${idEvento}/inscritos`
        );

        if (!respuesta.ok) {
            throw new Error("No se pudieron consultar los inscritos");
        }

        const inscritos = await respuesta.json();

        if (inscritos.length === 0) {
            listaAsistencia.textContent =
                "Este evento no tiene inscripciones activas.";
            return;
        }

        const resumen = document.createElement("p");
        resumen.textContent =
            `Total inscritos: ${inscritos.length} | ` +
            `Asistentes: ${inscritos.filter(i => i.asistio).length}`;

        listaAsistencia.appendChild(resumen);

        inscritos.forEach(inscrito => {
            const fila = document.createElement("div");
            fila.className = "fila-asistencia";

            const datos = document.createElement("div");

            const nombre = document.createElement("strong");
            nombre.textContent = inscrito.nombre;

            const correo = document.createElement("p");
            correo.textContent = inscrito.correo;

            datos.append(nombre, correo);

            const etiqueta = document.createElement("label");

            const casilla = document.createElement("input");
            casilla.type = "checkbox";
            casilla.checked = inscrito.asistio;

            etiqueta.append(casilla, " Asistió");

            casilla.addEventListener("change", async () => {
                casilla.disabled = true;

                try {
                    const respuesta = await fetch(
                        `/api/inscripciones/${inscrito.id_inscripcion}/asistencia`,
                        {
                            method: "PATCH",
                            headers: {
                                "Content-Type": "application/json"
                            },
                            body: JSON.stringify({
                                asistio: casilla.checked
                            })
                        }
                    );

                    if (!respuesta.ok) {
                        throw new Error(
                            "No se pudo actualizar la asistencia"
                        );
                    }

                    await cargarInscritos();

                } catch (error) {
                    alert(error.message);
                    casilla.checked = inscrito.asistio;
                    casilla.disabled = false;
                }
            });

            fila.append(datos, etiqueta);
            listaAsistencia.appendChild(fila);
        });

    } catch (error) {
        listaAsistencia.textContent = error.message;
    }
}

selectorAsistencia.addEventListener(
    "change",
    cargarInscritos
);

cargarEventosAsistencia();

async function editarEvento(id) {
    try {
        const respuesta = await fetch(
            `/api/mis-eventos/${id}`
        );

        const evento = await respuesta.json();

        if (!respuesta.ok) {
            throw new Error(evento.error);
        }

        eventoEnEdicion = id;

        document.getElementById("titulo").value = evento.titulo;
        document.getElementById("descripcion").value =
            evento.descripcion || "";
        document.getElementById("fecha_inicio").value =
            evento.fecha_inicio;
        document.getElementById("fecha_limite").value =
            evento.fecha_limite;
        document.getElementById("lugar").value = evento.lugar;
        document.getElementById("cupo_maximo").value =
            evento.cupo_maximo;
        document.getElementById("id_categoria").value =
            evento.id_categoria;

        document.getElementById("guardarEvento").textContent =
            "Guardar cambios";

        document.getElementById("cancelarEdicion").hidden = false;

        formulario.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

    } catch (error) {
        alert(error.message);
    }
}

function salirEdicion() {
    eventoEnEdicion = null;
    formulario.reset();

    document.getElementById("guardarEvento").textContent =
        "Crear evento";

    document.getElementById("cancelarEdicion").hidden = true;
}

document.getElementById("cancelarEdicion")
    .addEventListener("click", salirEdicion);
