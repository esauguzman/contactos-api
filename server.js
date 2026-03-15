const express = require('express');
const multer  = require('multer');
const { v4: uuidv4 } = require('uuid');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');

const app    = express();
const PUERTO = process.env.PORT || 3000;

// Crear carpeta uploads si no existe
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

app.use(cors());
app.use(express.json());
app.use('/fotos', express.static(path.join(__dirname, 'uploads')));

const guardado = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename:    (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const subir = multer({
  storage: guardado,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /jpeg|jpg|png|gif|webp/.test(file.mimetype);
    ok ? cb(null, true) : cb(new Error('Solo imágenes'));
  }
});

class Contacto {
  constructor(datos) {
    this.id        = uuidv4();
    this.nombre    = datos.nombre;
    this.telefono  = datos.telefono;
    this.email     = datos.email     || '';
    this.direccion = datos.direccion || '';
    this.lat       = datos.lat  ? parseFloat(datos.lat)  : null;
    this.lng       = datos.lng  ? parseFloat(datos.lng)  : null;
    this.foto      = datos.foto || null;
    this.fecha     = new Date().toISOString();
  }
}

let lista = [];

function validar(datos, esEdicion = false) {
  const errores = [];
  if (!esEdicion) {
    if (!datos.nombre   || datos.nombre.trim()   === '') errores.push('El nombre es requerido');
    if (!datos.telefono || datos.telefono.trim() === '') errores.push('El teléfono es requerido');
  }
  if (datos.nombre    && datos.nombre.trim().length < 2)
    errores.push('El nombre debe tener al menos 2 caracteres');
  if (datos.telefono  && !/^\+?[\d\s\-()]{7,20}$/.test(datos.telefono))
    errores.push('El teléfono no es válido');
  if (datos.email     && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.email))
    errores.push('El email no es válido');
  return errores;
}

app.get('/contactos', (req, res) => {
  const { buscar } = req.query;
  let resultado = lista;
  if (buscar) {
    const texto = buscar.toLowerCase();
    resultado = lista.filter(c =>
      c.nombre.toLowerCase().includes(texto)   ||
      c.telefono.toLowerCase().includes(texto) ||
      (c.email     && c.email.toLowerCase().includes(texto)) ||
      (c.direccion && c.direccion.toLowerCase().includes(texto))
    );
  }
  res.json({ total: resultado.length, contactos: resultado });
});

app.get('/contactos/:id', (req, res) => {
  const contacto = lista.find(c => c.id === req.params.id);
  if (!contacto) return res.status(404).json({ error: 'Contacto no encontrado' });
  res.json(contacto);
});

app.post('/contactos', subir.single('foto'), (req, res) => {
  const errores = validar(req.body);
  if (errores.length > 0) return res.status(400).json({ errores });
  const nuevo = new Contacto({ ...req.body, foto: req.file ? req.file.filename : null });
  lista.push(nuevo);
  res.status(201).json({ mensaje: 'Contacto creado', contacto: nuevo });
});

app.put('/contactos/:id', subir.single('foto'), (req, res) => {
  const indice = lista.findIndex(c => c.id === req.params.id);
  if (indice === -1) return res.status(404).json({ error: 'Contacto no encontrado' });
  const errores = validar(req.body, true);
  if (errores.length > 0) return res.status(400).json({ errores });
  const viejo = lista[indice];
  lista[indice] = {
    ...viejo,
    nombre:    req.body.nombre    ?? viejo.nombre,
    telefono:  req.body.telefono  ?? viejo.telefono,
    email:     req.body.email     ?? viejo.email,
    direccion: req.body.direccion ?? viejo.direccion,
    lat:       req.body.lat ? parseFloat(req.body.lat) : viejo.lat,
    lng:       req.body.lng ? parseFloat(req.body.lng) : viejo.lng,
    foto:      req.file ? req.file.filename : viejo.foto,
  };
  res.json({ mensaje: 'Contacto actualizado', contacto: lista[indice] });
});

app.delete('/contactos/:id', (req, res) => {
  const indice = lista.findIndex(c => c.id === req.params.id);
  if (indice === -1) return res.status(404).json({ error: 'Contacto no encontrado' });
  lista.splice(indice, 1);
  res.json({ mensaje: 'Contacto eliminado' });
});

app.get('/mapa/:id', (req, res) => {
  const contacto = lista.find(c => c.id === req.params.id);
  if (!contacto) return res.status(404).json({ error: 'Contacto no encontrado' });
  if (!contacto.lat || !contacto.lng)
    return res.status(400).json({ error: 'Este contacto no tiene ubicación' });
  const gmaps = `https://www.google.com/maps/dir/?api=1&destination=${contacto.lat},${contacto.lng}&travelmode=driving`;
  res.json({ nombre: contacto.nombre, lat: contacto.lat, lng: contacto.lng, gmaps });
});

app.listen(PUERTO, '0.0.0.0', () => {
  console.log(`✅ API corriendo en puerto ${PUERTO}`);
});

