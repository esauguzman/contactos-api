const express = require('express');
const multer  = require('multer');
const { v4: uuidv4 } = require('uuid');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');

const app    = express();
const PUERTO = process.env.PORT || 3000;

if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

app.use(cors());
app.use(express.json());
app.use('/fotos', express.static(path.join(__dirname, 'uploads')));

const guardado = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename:    (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${uuidv4()}${ext}`);
  }
});

const subir = multer({
  storage: guardado,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    cb(null, true);
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
    if (!datos.telefono || datos.telefono.trim() === '') errores.push('El telefono es requerido');
  }
  if (datos.nombre   && datos.nombre.trim().length < 2)
    errores.push('El nombre debe tener al menos 2 caracteres');
  return errores;
}

app.get('/', (req, res) => {
  res.json({ mensaje: 'API de Contactos funcionando ✅', version: '1.0' });
});

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
    return res.status(400).json({ error: 'Este contacto no tiene ubicacion' });
  const gmaps = `https://www.google.com/maps/dir/?api=1&destination=${contacto.lat},${contacto.lng}&travelmode=driving`;
  res.json({ nombre: contacto.nombre, lat: contacto.lat, lng: contacto.lng, gmaps });
});

app.get('/galeria', (req, res) => {
  const contactosConFoto = lista.filter(c => c.foto);

  const tarjetas = contactosConFoto.map(c => `
    <div style="background:#1e1e2e;border-radius:12px;padding:16px;text-align:center;box-shadow:0 4px 15px rgba(0,0,0,0.3)">
      <img src="/fotos/${c.foto}" style="width:120px;height:120px;border-radius:50%;object-fit:cover;border:3px solid #7c3aed"/>
      <h3 style="color:#fff;margin:10px 0 4px">${c.nombre}</h3>
      <p style="color:#a0a0b0;margin:2px 0">📞 ${c.telefono}</p>
      <p style="color:#a0a0b0;margin:2px 0">📍 ${c.direccion}</p>
    </div>
  `).join('');

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8"/>
      <title>Galería de Contactos</title>
    </head>
    <body style="margin:0;padding:24px;background:#0f0f1a;font-family:sans-serif">
      <h1 style="color:#7c3aed;text-align:center">📸 Galería de Contactos</h1>
      <p style="color:#a0a0b0;text-align:center">${contactosConFoto.length} contactos con foto</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:20px;max-width:900px;margin:0 auto">
        ${tarjetas}
      </div>
    </body>
    </html>
  `);
});

app.listen(PUERTO, '0.0.0.0', () => {
  console.log(`API corriendo en puerto ${PUERTO}`);
});
```

Copia todo, pégalo en tu archivo `index.js`, guarda y sube a GitHub. Railway lo desplegará automáticamente. Luego entra a:
```
https://contactos-api-production-01af.up.railway.app/galeria
