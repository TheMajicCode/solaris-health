/**
 * LUCA Marketplace — Provider seed data (El Salvador launch market).
 * Idempotent: clears provider_* tables, then inserts a curated network of
 * ~36 health & wellness providers across all supported types with services,
 * credentials, photos and reviews.
 *
 * Run:  node seeds/providers.js     (from the backend/ directory)
 */
const db = require('../src/db');

// Stable, license-free imagery (Unsplash source URLs)
const IMG = {
  clinic: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=1200&q=80',
  clinic2: 'https://images.unsplash.com/photo-1538108149393-fbbd81895907?w=1200&q=80',
  dental: 'https://images.unsplash.com/photo-1606811841689-23dfddce3e95?w=1200&q=80',
  dental2: 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=1200&q=80',
  farm: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1200&q=80',
  farm2: 'https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=1200&q=80',
  yoga: 'https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=1200&q=80',
  yoga2: 'https://images.unsplash.com/photo-1599447421416-3414500d18a5?w=1200&q=80',
  gym: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1200&q=80',
  gym2: 'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=1200&q=80',
  spa: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=1200&q=80',
  spa2: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1200&q=80',
  nutrition: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=1200&q=80',
  nutrition2: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=1200&q=80',
  therapy: 'https://images.unsplash.com/photo-1573497491208-6b1acb260507?w=1200&q=80',
  doctor: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=1200&q=80',
  doctor2: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=1200&q=80',
  workshop: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1200&q=80',
  workshop2: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=1200&q=80',
  wellness: 'https://images.unsplash.com/photo-1600334129128-685c5582fd35?w=1200&q=80',
  wellness2: 'https://images.unsplash.com/photo-1505576399279-565b52d4ac71?w=1200&q=80',
};

// El Salvador city anchor coordinates
const CITY = {
  'San Salvador': [13.6929, -89.2182],
  'Santa Tecla': [13.6731, -89.2797],
  'Antiguo Cuscatlán': [13.6731, -89.2476],
  'Santa Ana': [13.9942, -89.5597],
  'San Miguel': [13.4833, -88.1833],
  'La Libertad': [13.4883, -89.3222],
  'Sonsonate': [13.7186, -89.7242],
  'Ahuachapán': [13.9214, -89.8450],
};

// jitter coordinates a little so markers don't overlap
function near(city, dlat = 0, dlon = 0) {
  const [la, lo] = CITY[city];
  return [la + dlat, lo + dlon];
}

const HOURS = {
  mon: '8:00–17:00', tue: '8:00–17:00', wed: '8:00–17:00',
  thu: '8:00–17:00', fri: '8:00–16:00', sat: '9:00–13:00', sun: 'Closed',
};

const P = (o) => o; // identity for readability

const PROVIDERS = [
  // ---------------- CLINICS ----------------
  P({ type: 'clinic', name: 'Clínica Solaris', city: 'San Salvador', d: [0.004, 0.003],
    desc: 'Flagship integrative health clinic blending functional medicine, regenerative therapies and preventive care under one roof.',
    addr: 'Col. Escalón, Paseo General Escalón, San Salvador', phone: '+503 2222 1010', web: 'https://solaris.health',
    price: '$$$', rating: 4.9, reviews: 214, verified: true, vtv: true, featured: true,
    specialties: ['Functional Medicine', 'Regenerative Therapy', 'Preventive Care'], cover: IMG.clinic, photo: IMG.clinic,
    gallery: [IMG.clinic, IMG.clinic2, IMG.doctor],
    services: [
      { n: 'Functional Medicine Consult', p: 120, dur: 60, cat: 'Consultation' },
      { n: 'IV Nutrient Therapy', p: 95, dur: 45, cat: 'Therapy' },
      { n: 'Comprehensive Bloodwork Panel', p: 180, dur: 30, cat: 'Diagnostics' },
    ],
    creds: [
      { t: 'vtv_badge', n: 'VTV Verified Provider', by: 'Solaris Trust Network' },
      { t: 'license', n: 'Clinic Operating License', by: 'Ministerio de Salud El Salvador' },
    ],
    revs: [ ['Andrea M.', 5, 'The most thorough health assessment I have ever had.'], ['Carlos R.', 5, 'Modern facility and caring staff.'] ] }),

  P({ type: 'clinic', name: 'Centro Médico Vida Plena', city: 'Santa Ana', d: [0.006, -0.004],
    desc: 'Community clinic focused on family medicine and chronic-condition reversal through lifestyle programs.',
    addr: 'Av. Independencia, Santa Ana', phone: '+503 2440 2020', web: 'https://vidaplena.sv',
    price: '$$', rating: 4.6, reviews: 88, verified: true, vtv: false, featured: false,
    specialties: ['Family Medicine', 'Diabetes Reversal'], cover: IMG.clinic2, photo: IMG.clinic2,
    gallery: [IMG.clinic2, IMG.doctor2],
    services: [ { n: 'Family Check-up', p: 45, dur: 40, cat: 'Consultation' }, { n: 'Metabolic Health Program', p: 250, dur: 90, cat: 'Program' } ],
    creds: [ { t: 'license', n: 'Clinic License', by: 'Ministerio de Salud' } ],
    revs: [ ['Marta L.', 5, 'They helped me get off my diabetes medication.'] ] }),

  P({ type: 'clinic', name: 'Clínica Integral Cuscatlán', city: 'Antiguo Cuscatlán', d: [-0.003, 0.002],
    desc: 'Boutique multi-specialty clinic with on-site lab and telehealth follow-ups.',
    addr: 'Santa Elena, Antiguo Cuscatlán', phone: '+503 2528 3030', web: 'https://integralcusca.sv',
    price: '$$$', rating: 4.7, reviews: 132, verified: true, vtv: true, featured: false,
    specialties: ['Internal Medicine', 'Telehealth'], cover: IMG.clinic, photo: IMG.clinic,
    gallery: [IMG.clinic, IMG.doctor],
    services: [ { n: 'Internal Medicine Consult', p: 70, dur: 45, cat: 'Consultation' } ],
    creds: [ { t: 'vtv_badge', n: 'VTV Verified Provider', by: 'Solaris Trust Network' } ],
    revs: [ ['Diego F.', 4, 'Great care, parking can be tricky.'] ] }),

  // ---------------- DOCTORS ----------------
  P({ type: 'doctor', name: 'Dr. Roberto Méndez — Cardiología', city: 'San Salvador', d: [0.002, -0.005],
    desc: 'Preventive cardiologist specializing in early detection and heart-healthy lifestyle medicine.',
    addr: 'Torre Médica, Col. Médica, San Salvador', phone: '+503 2225 4040', web: null,
    price: '$$$', rating: 4.8, reviews: 96, verified: true, vtv: false, featured: false,
    specialties: ['Cardiology', 'Preventive Medicine'], cover: IMG.doctor, photo: IMG.doctor,
    gallery: [IMG.doctor, IMG.doctor2],
    services: [ { n: 'Cardiology Consultation', p: 85, dur: 40, cat: 'Consultation' }, { n: 'Echocardiogram', p: 120, dur: 30, cat: 'Diagnostics' } ],
    creds: [ { t: 'license', n: 'Medical License JVPM', by: 'Junta de Vigilancia' }, { t: 'certification', n: 'Board Certified Cardiologist', by: 'Colegio Médico' } ],
    revs: [ ['Sofía P.', 5, 'Detected an issue my previous doctor missed.'] ] }),

  P({ type: 'doctor', name: 'Dra. Lucía Hernández — Medicina Interna', city: 'Santa Tecla', d: [0.003, 0.004],
    desc: 'Internist with a holistic approach to gut health, hormones and metabolic balance.',
    addr: 'Plaza Merliot, Santa Tecla', phone: '+503 2278 5050', web: null,
    price: '$$', rating: 4.7, reviews: 71, verified: true, vtv: true, featured: false,
    specialties: ['Internal Medicine', 'Hormone Health'], cover: IMG.doctor2, photo: IMG.doctor2,
    gallery: [IMG.doctor2],
    services: [ { n: 'Internal Medicine Consult', p: 65, dur: 45, cat: 'Consultation' } ],
    creds: [ { t: 'vtv_badge', n: 'VTV Verified Provider', by: 'Solaris Trust Network' } ],
    revs: [ ['Ana G.', 5, 'Finally a doctor who listens.'] ] }),

  P({ type: 'doctor', name: 'Dr. Ernesto Portillo — Dermatología', city: 'San Miguel', d: [0.004, 0.003],
    desc: 'Dermatologist offering medical and aesthetic skin care with a natural-first philosophy.',
    addr: 'Av. Roosevelt, San Miguel', phone: '+503 2661 6060', web: null,
    price: '$$', rating: 4.5, reviews: 54, verified: false, vtv: false, featured: false,
    specialties: ['Dermatology', 'Aesthetics'], cover: IMG.doctor, photo: IMG.doctor,
    gallery: [IMG.doctor],
    services: [ { n: 'Skin Consultation', p: 55, dur: 30, cat: 'Consultation' } ],
    creds: [ { t: 'license', n: 'Medical License JVPM', by: 'Junta de Vigilancia' } ],
    revs: [ ['Luis A.', 4, 'Cleared up my long-standing skin issue.'] ] }),

  // ---------------- DENTISTS ----------------
  P({ type: 'dentist', name: 'Clínica Dental Sonrisa', city: 'San Salvador', d: [-0.004, 0.004],
    desc: 'Holistic dentistry practice using biocompatible materials and minimally invasive techniques.',
    addr: 'Col. San Benito, San Salvador', phone: '+503 2243 7070', web: 'https://sonrisa.sv',
    price: '$$', rating: 4.8, reviews: 167, verified: true, vtv: true, featured: true,
    specialties: ['Holistic Dentistry', 'Cosmetic Dentistry'], cover: IMG.dental, photo: IMG.dental,
    gallery: [IMG.dental, IMG.dental2],
    services: [ { n: 'Dental Cleaning', p: 40, dur: 45, cat: 'Hygiene' }, { n: 'Ceramic Filling', p: 90, dur: 60, cat: 'Restoration' }, { n: 'Teeth Whitening', p: 150, dur: 60, cat: 'Cosmetic' } ],
    creds: [ { t: 'vtv_badge', n: 'VTV Verified Provider', by: 'Solaris Trust Network' }, { t: 'license', n: 'Dental License', by: 'Ministerio de Salud' } ],
    revs: [ ['Patricia V.', 5, 'Painless and beautiful results.'], ['Jorge M.', 5, 'Best dental experience in the country.'] ] }),

  P({ type: 'dentist', name: 'Dental Care Cuscatlán', city: 'Antiguo Cuscatlán', d: [0.002, -0.003],
    desc: 'Family and pediatric dentistry with a gentle, prevention-first approach.',
    addr: 'Multiplaza, Antiguo Cuscatlán', phone: '+503 2528 8080', web: null,
    price: '$$', rating: 4.6, reviews: 79, verified: true, vtv: false, featured: false,
    specialties: ['Family Dentistry', 'Pediatric'], cover: IMG.dental2, photo: IMG.dental2,
    gallery: [IMG.dental2],
    services: [ { n: 'Child Dental Check-up', p: 35, dur: 30, cat: 'Hygiene' } ],
    creds: [ { t: 'license', n: 'Dental License', by: 'Ministerio de Salud' } ],
    revs: [ ['Karla S.', 5, 'My kids actually enjoy going to the dentist now.'] ] }),

  // ---------------- NUTRITIONISTS ----------------
  P({ type: 'nutritionist', name: 'Dr. Elena Rodriguez — Nutrición', city: 'San Salvador', d: [0.005, 0.002],
    desc: 'Clinical nutritionist specializing in metabolic health, gut microbiome and plant-forward eating.',
    addr: 'Col. Escalón, San Salvador', phone: '+503 2222 9090', web: 'https://elenanutricion.sv',
    price: '$$', rating: 5.0, reviews: 143, verified: true, vtv: true, featured: true,
    specialties: ['Clinical Nutrition', 'Microbiome', 'Plant-Based'], cover: IMG.nutrition, photo: IMG.nutrition,
    gallery: [IMG.nutrition, IMG.nutrition2],
    services: [ { n: 'Nutrition Assessment', p: 60, dur: 60, cat: 'Consultation' }, { n: 'Personalized Meal Plan', p: 80, dur: 45, cat: 'Program' }, { n: 'Gut Health Protocol', p: 200, dur: 90, cat: 'Program' } ],
    creds: [ { t: 'vtv_badge', n: 'VTV Verified Provider', by: 'Solaris Trust Network' }, { t: 'certification', n: 'Registered Dietitian Nutritionist', by: 'Colegio de Nutricionistas' }, { t: 'award', n: 'Top Wellness Provider 2025', by: 'Solaris Health' } ],
    revs: [ ['Gabriela T.', 5, 'Changed my relationship with food completely.'], ['Mauricio E.', 5, 'Lost 12kg and feel amazing.'] ] }),

  P({ type: 'nutritionist', name: 'NutriVida — Centro de Nutrición', city: 'Santa Tecla', d: [-0.002, 0.003],
    desc: 'Nutrition center offering sports nutrition, weight management and pediatric guidance.',
    addr: 'Santa Tecla centro', phone: '+503 2278 1212', web: null,
    price: '$', rating: 4.5, reviews: 62, verified: false, vtv: false, featured: false,
    specialties: ['Sports Nutrition', 'Weight Management'], cover: IMG.nutrition2, photo: IMG.nutrition2,
    gallery: [IMG.nutrition2],
    services: [ { n: 'Sports Nutrition Plan', p: 50, dur: 45, cat: 'Program' } ],
    creds: [ { t: 'certification', n: 'Sports Nutrition Cert.', by: 'ISSN' } ],
    revs: [ ['Roberto C.', 4, 'Great for athletes.'] ] }),

  // ---------------- THERAPISTS ----------------
  P({ type: 'therapist', name: 'Espacio Calma — Psicoterapia', city: 'San Salvador', d: [0.001, 0.006],
    desc: 'Mental wellness studio offering individual therapy, mindfulness and trauma-informed care.',
    addr: 'Col. Escalón, San Salvador', phone: '+503 2223 3434', web: 'https://espaciocalma.sv',
    price: '$$', rating: 4.9, reviews: 108, verified: true, vtv: true, featured: false,
    specialties: ['Psychotherapy', 'Mindfulness', 'Trauma'], cover: IMG.therapy, photo: IMG.therapy,
    gallery: [IMG.therapy],
    services: [ { n: 'Individual Therapy Session', p: 55, dur: 50, cat: 'Therapy' }, { n: 'Couples Therapy', p: 80, dur: 60, cat: 'Therapy' } ],
    creds: [ { t: 'vtv_badge', n: 'VTV Verified Provider', by: 'Solaris Trust Network' }, { t: 'license', n: 'Clinical Psychology License', by: 'Junta de Vigilancia' } ],
    revs: [ ['Anónimo', 5, 'A safe space that truly helped me heal.'] ] }),

  P({ type: 'therapist', name: 'Centro de Fisioterapia Movimiento', city: 'La Libertad', d: [0.003, 0.002],
    desc: 'Physical therapy and rehabilitation clinic for sports injuries and chronic pain.',
    addr: 'El Tunco, La Libertad', phone: '+503 2310 5656', web: null,
    price: '$$', rating: 4.7, reviews: 84, verified: true, vtv: false, featured: false,
    specialties: ['Physiotherapy', 'Sports Rehab'], cover: IMG.therapy, photo: IMG.therapy,
    gallery: [IMG.therapy, IMG.gym],
    services: [ { n: 'Physiotherapy Session', p: 45, dur: 50, cat: 'Therapy' }, { n: 'Sports Injury Rehab', p: 60, dur: 60, cat: 'Therapy' } ],
    creds: [ { t: 'license', n: 'Physiotherapy License', by: 'Ministerio de Salud' } ],
    revs: [ ['Surfer Dave', 5, 'Got me back on my board after a shoulder injury.'] ] }),

  // ---------------- WELLNESS CENTERS ----------------
  P({ type: 'wellness', name: 'Casa Bienestar', city: 'Santa Tecla', d: [0.004, -0.002],
    desc: 'Holistic wellness center offering acupuncture, reiki, breathwork and sound healing.',
    addr: 'Paseo El Carmen, Santa Tecla', phone: '+503 2278 7878', web: 'https://casabienestar.sv',
    price: '$$', rating: 4.8, reviews: 121, verified: true, vtv: true, featured: true,
    specialties: ['Acupuncture', 'Reiki', 'Breathwork'], cover: IMG.wellness, photo: IMG.wellness,
    gallery: [IMG.wellness, IMG.wellness2, IMG.spa],
    services: [ { n: 'Acupuncture Session', p: 50, dur: 60, cat: 'Therapy' }, { n: 'Sound Healing', p: 35, dur: 45, cat: 'Therapy' }, { n: 'Breathwork Class', p: 25, dur: 60, cat: 'Class' } ],
    creds: [ { t: 'vtv_badge', n: 'VTV Verified Provider', by: 'Solaris Trust Network' } ],
    revs: [ ['Valeria N.', 5, 'My weekly reset. Absolutely love it.'] ] }),

  P({ type: 'wellness', name: 'Holística Santa Ana', city: 'Santa Ana', d: [-0.005, 0.003],
    desc: 'Integrative wellness studio with herbal medicine, massage and energy work.',
    addr: 'Centro histórico, Santa Ana', phone: '+503 2440 9292', web: null,
    price: '$', rating: 4.4, reviews: 47, verified: false, vtv: false, featured: false,
    specialties: ['Herbal Medicine', 'Massage'], cover: IMG.wellness2, photo: IMG.wellness2,
    gallery: [IMG.wellness2],
    services: [ { n: 'Herbal Consultation', p: 30, dur: 45, cat: 'Consultation' } ],
    creds: [ { t: 'certification', n: 'Herbalism Cert.', by: 'Instituto Botánico' } ],
    revs: [ ['Cecilia R.', 4, 'Lovely herbal teas and advice.'] ] }),

  // ---------------- GYMS ----------------
  P({ type: 'gym', name: 'Vital Strength Gym', city: 'San Salvador', d: [-0.003, -0.004],
    desc: 'Performance gym with strength training, mobility coaching and recovery facilities.',
    addr: 'Col. San Benito, San Salvador', phone: '+503 2243 1313', web: 'https://vitalstrength.sv',
    price: '$$', rating: 4.7, reviews: 156, verified: true, vtv: false, featured: false,
    specialties: ['Strength Training', 'Mobility', 'Recovery'], cover: IMG.gym, photo: IMG.gym,
    gallery: [IMG.gym, IMG.gym2],
    services: [ { n: 'Monthly Membership', p: 45, dur: null, cat: 'Membership' }, { n: 'Personal Training', p: 30, dur: 60, cat: 'Coaching' } ],
    creds: [ { t: 'certification', n: 'Certified Strength Coaches', by: 'NSCA' } ],
    revs: [ ['Bryan O.', 5, 'Best equipment and coaches in the city.'] ] }),

  P({ type: 'gym', name: 'CrossFit Volcán', city: 'Santa Tecla', d: [-0.004, -0.003],
    desc: 'Community-driven functional fitness box with daily WODs and nutrition coaching.',
    addr: 'Santa Tecla', phone: '+503 2278 2424', web: null,
    price: '$$', rating: 4.6, reviews: 93, verified: true, vtv: false, featured: false,
    specialties: ['CrossFit', 'Functional Fitness'], cover: IMG.gym2, photo: IMG.gym2,
    gallery: [IMG.gym2],
    services: [ { n: 'Drop-in Class', p: 12, dur: 60, cat: 'Class' }, { n: 'Monthly Unlimited', p: 60, dur: null, cat: 'Membership' } ],
    creds: [ { t: 'certification', n: 'CrossFit L2 Trainers', by: 'CrossFit Inc.' } ],
    revs: [ ['Wendy A.', 5, 'Amazing community, never miss a day.'] ] }),

  P({ type: 'gym', name: 'Yoga & Pilates Studio Luz', city: 'Antiguo Cuscatlán', d: [0.003, 0.005],
    desc: 'Boutique studio for yoga, pilates and barre with experienced instructors.',
    addr: 'Santa Elena, Antiguo Cuscatlán', phone: '+503 2528 3636', web: null,
    price: '$$', rating: 4.9, reviews: 112, verified: true, vtv: true, featured: false,
    specialties: ['Yoga', 'Pilates', 'Barre'], cover: IMG.yoga, photo: IMG.yoga,
    gallery: [IMG.yoga, IMG.yoga2],
    services: [ { n: 'Drop-in Yoga Class', p: 10, dur: 60, cat: 'Class' }, { n: '10-Class Pack', p: 85, dur: null, cat: 'Package' } ],
    creds: [ { t: 'vtv_badge', n: 'VTV Verified Provider', by: 'Solaris Trust Network' } ],
    revs: [ ['Daniela P.', 5, 'The instructors are world class.'] ] }),

  // ---------------- SPAS ----------------
  P({ type: 'spa', name: 'Serenidad Spa & Recovery', city: 'La Libertad', d: [-0.002, 0.004],
    desc: 'Oceanfront spa offering massage, hydrotherapy, sauna and cold plunge recovery.',
    addr: 'Playa El Tunco, La Libertad', phone: '+503 2310 4747', web: 'https://serenidadspa.sv',
    price: '$$$', rating: 4.8, reviews: 134, verified: true, vtv: true, featured: true,
    specialties: ['Massage', 'Hydrotherapy', 'Cold Plunge'], cover: IMG.spa, photo: IMG.spa,
    gallery: [IMG.spa, IMG.spa2, IMG.wellness],
    services: [ { n: 'Deep Tissue Massage', p: 70, dur: 60, cat: 'Massage' }, { n: 'Contrast Therapy', p: 45, dur: 45, cat: 'Recovery' }, { n: 'Full Spa Day', p: 180, dur: 240, cat: 'Package' } ],
    creds: [ { t: 'vtv_badge', n: 'VTV Verified Provider', by: 'Solaris Trust Network' } ],
    revs: [ ['Isabella M.', 5, 'Pure bliss with an ocean view.'] ] }),

  P({ type: 'spa', name: 'Aqua Wellness Spa', city: 'San Salvador', d: [0.006, -0.002],
    desc: 'Urban day spa specializing in facials, lymphatic drainage and aromatherapy.',
    addr: 'Col. Escalón, San Salvador', phone: '+503 2222 5858', web: null,
    price: '$$', rating: 4.5, reviews: 67, verified: true, vtv: false, featured: false,
    specialties: ['Facials', 'Lymphatic Drainage'], cover: IMG.spa2, photo: IMG.spa2,
    gallery: [IMG.spa2],
    services: [ { n: 'Signature Facial', p: 55, dur: 60, cat: 'Facial' } ],
    creds: [ { t: 'certification', n: 'Licensed Estheticians', by: 'Instituto de Belleza' } ],
    revs: [ ['Fernanda L.', 4, 'My skin glows after every visit.'] ] }),

  // ---------------- FARMS ----------------
  P({ type: 'farm', name: 'Finca Verde Orgánica', city: 'Ahuachapán', d: [0.005, 0.006],
    desc: 'Certified organic farm producing heirloom vegetables, coffee and farm-to-table experiences.',
    addr: 'Ruta de las Flores, Ahuachapán', phone: '+503 2413 6969', web: 'https://fincaverde.sv',
    price: '$$', rating: 4.9, reviews: 98, verified: true, vtv: true, featured: true,
    specialties: ['Organic Produce', 'Coffee', 'Agrotourism'], cover: IMG.farm, photo: IMG.farm,
    gallery: [IMG.farm, IMG.farm2],
    services: [ { n: 'Weekly Produce Box', p: 25, dur: null, cat: 'Subscription' }, { n: 'Farm Tour & Tasting', p: 35, dur: 120, cat: 'Experience' } ],
    creds: [ { t: 'vtv_badge', n: 'VTV Verified Provider', by: 'Solaris Trust Network' }, { t: 'certification', n: 'Organic Certification', by: 'Mayacert' } ],
    revs: [ ['Pedro S.', 5, 'The freshest vegetables I have ever tasted.'], ['Lorena V.', 5, 'Beautiful farm, wonderful people.'] ] }),

  P({ type: 'farm', name: 'Granja El Manantial', city: 'Sonsonate', d: [-0.004, 0.005],
    desc: 'Regenerative family farm with free-range eggs, raw honey and seasonal produce.',
    addr: 'Sonsonate', phone: '+503 2451 7070', web: null,
    price: '$', rating: 4.7, reviews: 54, verified: true, vtv: false, featured: false,
    specialties: ['Free-range Eggs', 'Raw Honey'], cover: IMG.farm2, photo: IMG.farm2,
    gallery: [IMG.farm2],
    services: [ { n: 'Honey & Eggs Bundle', p: 15, dur: null, cat: 'Product' } ],
    creds: [ { t: 'certification', n: 'Regenerative Ag Practices', by: 'Red Agroecológica' } ],
    revs: [ ['Camila R.', 5, 'Best honey in El Salvador.'] ] }),

  P({ type: 'farm', name: 'Café Cumbre Sostenible', city: 'Santa Ana', d: [0.007, -0.005],
    desc: 'Shade-grown coffee estate on the Santa Ana volcano with sustainable practices.',
    addr: 'Volcán de Santa Ana', phone: '+503 2440 8181', web: 'https://cafecumbre.sv',
    price: '$$', rating: 4.8, reviews: 76, verified: true, vtv: true, featured: false,
    specialties: ['Specialty Coffee', 'Sustainability'], cover: IMG.farm, photo: IMG.farm,
    gallery: [IMG.farm, IMG.workshop],
    services: [ { n: 'Coffee Subscription', p: 20, dur: null, cat: 'Subscription' }, { n: 'Estate Tour', p: 30, dur: 150, cat: 'Experience' } ],
    creds: [ { t: 'vtv_badge', n: 'VTV Verified Provider', by: 'Solaris Trust Network' } ],
    revs: [ ['Hugo M.', 5, 'Incredible coffee and views.'] ] }),

  // ---------------- WORKSHOPS ----------------
  P({ type: 'workshop', name: 'Taller Raíz — Cocina Consciente', city: 'San Salvador', d: [0.002, 0.003],
    desc: 'Hands-on workshops in fermentation, plant-based cooking and mindful eating.',
    addr: 'Col. San Benito, San Salvador', phone: '+503 2243 9999', web: 'https://tallerraiz.sv',
    price: '$$', rating: 4.9, reviews: 64, verified: true, vtv: true, featured: false,
    specialties: ['Fermentation', 'Plant-Based Cooking'], cover: IMG.workshop, photo: IMG.workshop,
    gallery: [IMG.workshop, IMG.workshop2],
    services: [ { n: 'Fermentation Workshop', p: 40, dur: 180, cat: 'Workshop' }, { n: 'Plant-Based Cooking Class', p: 45, dur: 180, cat: 'Workshop' } ],
    creds: [ { t: 'vtv_badge', n: 'VTV Verified Provider', by: 'Solaris Trust Network' } ],
    revs: [ ['Natalia C.', 5, 'Learned so much, super fun.'] ] }),

  P({ type: 'workshop', name: 'Mindful Movement Lab', city: 'Santa Tecla', d: [0.005, 0.001],
    desc: 'Workshops blending breathwork, somatic movement and stress resilience training.',
    addr: 'Paseo El Carmen, Santa Tecla', phone: '+503 2278 1111', web: null,
    price: '$', rating: 4.6, reviews: 38, verified: false, vtv: false, featured: false,
    specialties: ['Breathwork', 'Somatics'], cover: IMG.workshop2, photo: IMG.workshop2,
    gallery: [IMG.workshop2],
    services: [ { n: 'Weekend Workshop', p: 30, dur: 240, cat: 'Workshop' } ],
    creds: [ { t: 'certification', n: 'Somatic Practitioner', by: 'Somatic Institute' } ],
    revs: [ ['Oscar D.', 5, 'Left feeling completely recharged.'] ] }),

  // ---------------- a few more to round out the network ----------------
  P({ type: 'clinic', name: 'Clínica de la Mujer Aurora', city: 'San Miguel', d: [-0.003, -0.004],
    desc: "Women's health clinic offering gynecology, prenatal care and hormonal wellness.",
    addr: 'San Miguel centro', phone: '+503 2661 2323', web: null,
    price: '$$', rating: 4.7, reviews: 81, verified: true, vtv: false, featured: false,
    specialties: ["Women's Health", 'Prenatal Care'], cover: IMG.clinic, photo: IMG.clinic,
    gallery: [IMG.clinic],
    services: [ { n: 'Gynecology Consult', p: 55, dur: 40, cat: 'Consultation' } ],
    creds: [ { t: 'license', n: 'Clinic License', by: 'Ministerio de Salud' } ],
    revs: [ ['Rosa M.', 5, 'Compassionate prenatal care.'] ] }),

  P({ type: 'nutritionist', name: 'Plant Power Nutrición', city: 'La Libertad', d: [0.004, -0.003],
    desc: 'Plant-based nutrition coaching for surfers and active coastal lifestyles.',
    addr: 'El Zonte, La Libertad', phone: '+503 2310 8888', web: null,
    price: '$', rating: 4.8, reviews: 45, verified: false, vtv: true, featured: false,
    specialties: ['Plant-Based', 'Athletic Performance'], cover: IMG.nutrition, photo: IMG.nutrition,
    gallery: [IMG.nutrition],
    services: [ { n: 'Online Coaching Month', p: 40, dur: null, cat: 'Program' } ],
    creds: [ { t: 'vtv_badge', n: 'VTV Verified Provider', by: 'Solaris Trust Network' } ],
    revs: [ ['Kelly W.', 5, 'Perfect for my surf lifestyle.'] ] }),

  P({ type: 'wellness', name: 'Templo del Sol — Yoga Retreat', city: 'La Libertad', d: [-0.005, -0.002],
    desc: 'Coastal yoga and meditation retreat center with daily classes and detox programs.',
    addr: 'El Sunzal, La Libertad', phone: '+503 2310 2727', web: 'https://templodelsol.sv',
    price: '$$$', rating: 4.9, reviews: 119, verified: true, vtv: true, featured: true,
    specialties: ['Yoga Retreat', 'Meditation', 'Detox'], cover: IMG.yoga, photo: IMG.yoga,
    gallery: [IMG.yoga, IMG.yoga2, IMG.spa],
    services: [ { n: 'Weekend Retreat', p: 220, dur: null, cat: 'Retreat' }, { n: 'Daily Drop-in', p: 12, dur: 75, cat: 'Class' } ],
    creds: [ { t: 'vtv_badge', n: 'VTV Verified Provider', by: 'Solaris Trust Network' }, { t: 'award', n: 'Best Retreat Center 2025', by: 'Solaris Health' } ],
    revs: [ ['Megan T.', 5, 'A life-changing week.'], ['Andrés P.', 5, 'Paradise for the soul.'] ] }),

  P({ type: 'doctor', name: 'Dr. Fernando Aguilar — Medicina Funcional', city: 'Antiguo Cuscatlán', d: [-0.002, 0.005],
    desc: 'Functional medicine physician focused on root-cause resolution and longevity.',
    addr: 'Santa Elena, Antiguo Cuscatlán', phone: '+503 2528 4545', web: null,
    price: '$$$', rating: 4.9, reviews: 87, verified: true, vtv: true, featured: false,
    specialties: ['Functional Medicine', 'Longevity'], cover: IMG.doctor2, photo: IMG.doctor2,
    gallery: [IMG.doctor2, IMG.doctor],
    services: [ { n: 'Longevity Assessment', p: 150, dur: 90, cat: 'Consultation' } ],
    creds: [ { t: 'vtv_badge', n: 'VTV Verified Provider', by: 'Solaris Trust Network' }, { t: 'certification', n: 'IFM Certified Practitioner', by: 'Institute for Functional Medicine' } ],
    revs: [ ['Ricardo B.', 5, 'Transformed my energy and focus.'] ] }),

  P({ type: 'gym', name: 'Aqua Fit San Miguel', city: 'San Miguel', d: [0.003, -0.002],
    desc: 'Aquatic fitness center with lap pool, aqua aerobics and rehabilitation programs.',
    addr: 'San Miguel', phone: '+503 2661 3838', web: null,
    price: '$$', rating: 4.4, reviews: 41, verified: false, vtv: false, featured: false,
    specialties: ['Aqua Fitness', 'Swimming'], cover: IMG.gym, photo: IMG.gym,
    gallery: [IMG.gym],
    services: [ { n: 'Aqua Aerobics Class', p: 8, dur: 45, cat: 'Class' } ],
    creds: [ { t: 'certification', n: 'Aquatic Instructors', by: 'Aquatic Fitness Assoc.' } ],
    revs: [ ['Gloria E.', 4, 'Gentle on my joints.'] ] }),

  P({ type: 'dentist', name: 'Ortodoncia Santa Ana', city: 'Santa Ana', d: [-0.006, -0.003],
    desc: 'Orthodontics specialist offering clear aligners and traditional braces.',
    addr: 'Santa Ana', phone: '+503 2440 4646', web: null,
    price: '$$', rating: 4.6, reviews: 58, verified: true, vtv: false, featured: false,
    specialties: ['Orthodontics', 'Clear Aligners'], cover: IMG.dental, photo: IMG.dental,
    gallery: [IMG.dental],
    services: [ { n: 'Orthodontic Consult', p: 40, dur: 45, cat: 'Consultation' } ],
    creds: [ { t: 'license', n: 'Dental License', by: 'Ministerio de Salud' } ],
    revs: [ ['Jaime R.', 5, 'My smile is perfect now.'] ] }),

  P({ type: 'therapist', name: 'Bienestar Mental Online', city: 'San Salvador', d: [-0.005, 0.005],
    desc: 'Telehealth therapy practice connecting Salvadorans worldwide with licensed psychologists.',
    addr: 'Remote / San Salvador', phone: '+503 2223 9090', web: 'https://bienestarmental.sv',
    price: '$$', rating: 4.8, reviews: 102, verified: true, vtv: true, featured: false,
    specialties: ['Online Therapy', 'Anxiety', 'Depression'], cover: IMG.therapy, photo: IMG.therapy,
    gallery: [IMG.therapy],
    services: [ { n: 'Online Therapy Session', p: 40, dur: 50, cat: 'Therapy' } ],
    creds: [ { t: 'vtv_badge', n: 'VTV Verified Provider', by: 'Solaris Trust Network' } ],
    revs: [ ['Anónimo', 5, 'Therapy from home changed everything for me.'] ] }),

  P({ type: 'spa', name: 'Volcanic Mud Retreat', city: 'Ahuachapán', d: [-0.004, -0.005],
    desc: 'Geothermal spa using volcanic mud and hot springs for natural detox and skin therapy.',
    addr: 'Los Ausoles, Ahuachapán', phone: '+503 2413 1717', web: null,
    price: '$$', rating: 4.7, reviews: 73, verified: true, vtv: false, featured: false,
    specialties: ['Hot Springs', 'Mud Therapy'], cover: IMG.spa, photo: IMG.spa,
    gallery: [IMG.spa, IMG.spa2],
    services: [ { n: 'Geothermal Mud Bath', p: 35, dur: 90, cat: 'Therapy' } ],
    creds: [ { t: 'certification', n: 'Natural Therapy Cert.', by: 'Instituto Termal' } ],
    revs: [ ['Beatriz L.', 5, 'My skin has never felt better.'] ] }),

  P({ type: 'workshop', name: 'Herbario Vivo — Talleres de Plantas', city: 'Sonsonate', d: [0.004, -0.004],
    desc: 'Workshops on medicinal plants, natural remedies and home herbal gardens.',
    addr: 'Sonsonate', phone: '+503 2451 2525', web: null,
    price: '$', rating: 4.5, reviews: 31, verified: false, vtv: false, featured: false,
    specialties: ['Medicinal Plants', 'Herbalism'], cover: IMG.workshop, photo: IMG.workshop,
    gallery: [IMG.workshop],
    services: [ { n: 'Herbal Garden Workshop', p: 25, dur: 150, cat: 'Workshop' } ],
    creds: [ { t: 'certification', n: 'Ethnobotany Cert.', by: 'Jardín Botánico' } ],
    revs: [ ['Tomás A.', 4, 'Fascinating and practical.'] ] }),

  P({ type: 'nutritionist', name: 'Equilibrio Nutricional', city: 'San Salvador', d: [-0.001, -0.006],
    desc: 'Family nutrition practice specializing in childhood nutrition and healthy habits.',
    addr: 'Col. Médica, San Salvador', phone: '+503 2225 7171', web: null,
    price: '$$', rating: 4.6, reviews: 49, verified: true, vtv: false, featured: false,
    specialties: ['Pediatric Nutrition', 'Family Health'], cover: IMG.nutrition2, photo: IMG.nutrition2,
    gallery: [IMG.nutrition2],
    services: [ { n: 'Family Nutrition Plan', p: 55, dur: 60, cat: 'Program' } ],
    creds: [ { t: 'certification', n: 'Registered Dietitian', by: 'Colegio de Nutricionistas' } ],
    revs: [ ['Mónica S.', 5, 'My whole family eats better now.'] ] }),

  P({ type: 'wellness', name: 'Reset Recovery Lounge', city: 'Antiguo Cuscatlán', d: [0.001, 0.002],
    desc: 'Modern recovery lounge with cryotherapy, compression therapy and IV drips.',
    addr: 'Multiplaza, Antiguo Cuscatlán', phone: '+503 2528 6262', web: 'https://resetlounge.sv',
    price: '$$$', rating: 4.7, reviews: 66, verified: true, vtv: true, featured: false,
    specialties: ['Cryotherapy', 'IV Therapy', 'Compression'], cover: IMG.wellness, photo: IMG.wellness,
    gallery: [IMG.wellness, IMG.wellness2],
    services: [ { n: 'Cryotherapy Session', p: 40, dur: 15, cat: 'Recovery' }, { n: 'Recovery IV Drip', p: 85, dur: 45, cat: 'Therapy' } ],
    creds: [ { t: 'vtv_badge', n: 'VTV Verified Provider', by: 'Solaris Trust Network' } ],
    revs: [ ['Eduardo M.', 5, 'My go-to after tough workouts.'] ] }),

  P({ type: 'farm', name: 'Huerto Urbano Colectivo', city: 'San Salvador', d: [0.003, 0.001],
    desc: 'Urban community garden offering CSA boxes, composting workshops and volunteer days.',
    addr: 'Col. Layco, San Salvador', phone: '+503 2226 3939', web: null,
    price: '$', rating: 4.5, reviews: 37, verified: false, vtv: false, featured: false,
    specialties: ['Urban Farming', 'Community Garden'], cover: IMG.farm2, photo: IMG.farm2,
    gallery: [IMG.farm2],
    services: [ { n: 'CSA Veggie Box', p: 18, dur: null, cat: 'Subscription' } ],
    creds: [ { t: 'certification', n: 'Urban Agriculture', by: 'Red Agroecológica' } ],
    revs: [ ['Sandra V.', 5, 'Love being part of this community.'] ] }),

  P({ type: 'doctor', name: 'Dra. Carmen Flores — Pediatría', city: 'Santa Tecla', d: [-0.003, -0.001],
    desc: 'Pediatrician with an integrative approach to child development and nutrition.',
    addr: 'Santa Tecla', phone: '+503 2278 4848', web: null,
    price: '$$', rating: 4.9, reviews: 94, verified: true, vtv: true, featured: false,
    specialties: ['Pediatrics', 'Child Development'], cover: IMG.doctor, photo: IMG.doctor,
    gallery: [IMG.doctor],
    services: [ { n: 'Pediatric Consult', p: 50, dur: 40, cat: 'Consultation' } ],
    creds: [ { t: 'vtv_badge', n: 'VTV Verified Provider', by: 'Solaris Trust Network' }, { t: 'license', n: 'Medical License JVPM', by: 'Junta de Vigilancia' } ],
    revs: [ ['Familia Ramírez', 5, 'The best pediatrician we could ask for.'] ] }),
];

async function seed() {
  console.log('Seeding marketplace providers…');
  // idempotent reset (CASCADE clears child tables via FKs)
  await db.query('TRUNCATE provider_profiles RESTART IDENTITY CASCADE');

  let count = 0;
  for (const p of PROVIDERS) {
    const [lat, lon] = near(p.city, p.d[0], p.d[1]);
    const ins = await db.query(
      `INSERT INTO provider_profiles
        (provider_type, business_name, description, address, city, country, latitude, longitude,
         phone, website, email, profile_photo_url, cover_photo_url, hours_of_operation, specialties,
         price_range, rating, review_count, verified, vtv_certified, featured, status, claimed)
       VALUES ($1,$2,$3,$4,$5,'El Salvador',$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,'active',false)
       RETURNING id`,
      [
        p.type, p.name, p.desc, p.addr, p.city, lat, lon, p.phone, p.web || null,
        (p.web ? `info@${p.web.replace(/^https?:\/\//, '')}` : null),
        p.photo, p.cover, JSON.stringify(HOURS), JSON.stringify(p.specialties),
        p.price, p.rating, p.reviews, p.verified, p.vtv, p.featured,
      ]
    );
    const pid = ins.rows[0].id;

    for (const s of p.services || []) {
      await db.query(
        `INSERT INTO provider_services (provider_id, service_name, price, currency, duration_minutes, category)
         VALUES ($1,$2,$3,'USD',$4,$5)`,
        [pid, s.n, s.p, s.dur, s.cat]
      );
    }
    for (const c of p.creds || []) {
      await db.query(
        `INSERT INTO provider_credentials (provider_id, credential_type, credential_name, issued_by, issued_date)
         VALUES ($1,$2,$3,$4, NOW() - (random()*365*2 || ' days')::interval)`,
        [pid, c.t, c.n, c.by]
      );
    }
    let order = 0;
    for (const url of p.gallery || []) {
      await db.query(
        'INSERT INTO provider_photos (provider_id, photo_url, sort_order) VALUES ($1,$2,$3)',
        [pid, url, order++]
      );
    }
    for (const [name, rating, text] of p.revs || []) {
      await db.query(
        `INSERT INTO provider_ratings (provider_id, user_id, author_name, rating, review_text, created_at)
         VALUES ($1, NULL, $2, $3, $4, NOW() - (random()*180 || ' days')::interval)`,
        [pid, name, rating, text]
      );
    }
    count++;
  }

  console.log(`✓ Seeded ${count} providers with services, credentials, photos and reviews.`);
}

if (require.main === module) {
  seed()
    .then(() => { console.log('Done.'); process.exit(0); })
    .catch((err) => { console.error('Seed failed:', err); process.exit(1); });
}

module.exports = { seed };
