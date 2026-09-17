-- =============================================================================
--  XAMOTO — Référentiels véhicules, garages et pièces (migration de données 002)
-- =============================================================================
--  Contenu : fiches techniques usuelles par marque/modèle/année, annuaire de
--  garages avec leurs spécialités déclarées, graphe de pièces et compatibilités.
--
--  IMPORTANT (§26, §28, §33)
--    • Une fiche technique manquante n'est PAS reconstruite : XAMOTO annonce
--      alors qu'il ne dispose pas de la donnée.
--    • Les prix sont des ordres de grandeur déclarés, jamais des devis.
--    • Un garage est décrit par des faits déclarés (équipement, spécialités),
--      jamais par un jugement de qualité.
-- =============================================================================

BEGIN;


-- Plages usuelles attribuées à une source (aucune valeur constructeur inventée)
-- 12 ligne(s)
-- Table : vehicle_specs

INSERT INTO vehicle_specs (id, brand, model, year_from, year_to, engine, fuel_type, oil_spec, oil_capacity_l, coolant_spec, timing_type, timing_interval_km, spark_plug_spec, spark_plug_interval_km, common_issues, source_id) VALUES
  ('spec_mu61jwkg01utmg', 'Toyota', 'Corolla', 2014, 2019, '1.6 VVT-i', 'essence', 'Selon carnet constructeur (vérifier la norme exacte du moteur)', 4.2, 'Liquide longue durée préconisé par le constructeur', 'chaine', NULL, 'Bougies iridium préconisées', 90000, '["Bobines d’allumage","Capteur de vilebrequin","Encrassement du boîtier papillon en usage poussiéreux"]', 'src_maintenance_ranges'),
  ('spec_mu61jwkg02q1v6', 'Toyota', 'Hilux', 2010, 2020, '2.5 D-4D', 'diesel', 'Huile diesel haut régime selon carnet constructeur', 6.9, 'Liquide longue durée', 'courroie', 150000, NULL, NULL, '["Encrassement vanne EGR","Colmatage filtre à particules","Usure injecteurs avec carburant de qualité variable"]', 'src_maintenance_ranges'),
  ('spec_mu61jwkg03oxjs', 'Hyundai', 'Accent', 2010, 2018, '1.6', 'essence', 'Selon carnet constructeur', 3.6, 'Liquide type constructeur', 'courroie', 90000, 'Bougies standard ou iridium selon version', 40000, '["Bobines d’allumage","Capteur de position vilebrequin","Fuite de durite de refroidissement"]', 'src_maintenance_ranges'),
  ('spec_mu61jwkg043c4r', 'Peugeot', '308', 2008, 2016, '1.6 VTi', 'essence', 'Selon carnet constructeur', 4.3, 'Liquide type constructeur', 'chaine', 180000, 'Bougies iridium', 60000, '["Distribution (chaîne)","Bobines d’allumage","Consommation d’huile"]', 'src_maintenance_ranges'),
  ('spec_mu61jwkg05cx1b', 'Peugeot', 'Partner', 2008, 2018, '1.6 HDi', 'diesel', 'Huile diesel selon carnet constructeur', 4.5, 'Liquide type constructeur', 'courroie', 150000, NULL, NULL, '["Vanne EGR encrassée","Filtre à particules colmaté en usage urbain","Injecteurs","Capteur de pression différentielle"]', 'src_maintenance_ranges'),
  ('spec_mu61jwkg06cjpy', 'Renault', 'Duster', 2010, 2018, '1.6 SCe', 'essence', 'Selon carnet constructeur', 4.3, 'Liquide type constructeur', 'chaine', NULL, 'Bougies standard', 40000, '["Capteur de position vilebrequin (calage à chaud)","Bobines d’allumage","Capteurs de roue"]', 'src_maintenance_ranges'),
  ('spec_mu61jwkg07knw4', 'Renault', 'Logan', 2010, 2020, '1.5 dCi', 'diesel', 'Huile diesel selon carnet constructeur', 4.5, 'Liquide type constructeur', 'courroie', 120000, NULL, NULL, '["Injecteurs","Vanne EGR","Capteur de pression de suralimentation","Fuite de retour d’injecteur"]', 'src_maintenance_ranges'),
  ('spec_mu61jwkg08s88m', 'Nissan', 'Sunny', 2011, 2019, '1.5', 'essence', 'Selon carnet constructeur', 3.9, 'Liquide type constructeur', 'chaine', NULL, 'Bougies iridium', 60000, '["Sonde O2 amont","Catalyseur en usage urbain","Boîtier papillon encrassé"]', 'src_maintenance_ranges'),
  ('spec_mu61jwkg09t9ga', 'Ford', 'Focus', 2011, 2018, '1.6 Ti-VCT', 'essence', 'Selon carnet constructeur', 4.3, 'Liquide type constructeur', 'courroie', 120000, 'Bougies iridium', 60000, '["Bobines d’allumage","Capteur de vilebrequin","Batterie (trajets courts)"]', 'src_maintenance_ranges'),
  ('spec_mu61jwkg0atl3v', 'Kia', 'Rio', 2012, 2020, '1.4', 'essence', 'Selon carnet constructeur', 3.6, 'Liquide type constructeur', 'chaine', NULL, 'Bougies standard', 40000, '["Capteurs de roue","Bobines d’allumage","Débitmètre encrassé"]', 'src_maintenance_ranges'),
  ('spec_mu61jwkg0bidyz', 'Mercedes-Benz', 'C-Class', 2008, 2016, 'C200 CDI', 'diesel', 'Huile selon spécification constructeur', 6.5, 'Liquide type constructeur', 'chaine', NULL, NULL, NULL, '["Injecteurs","Filtre à particules","Capteur de pression de suralimentation","Débitmètre"]', 'src_maintenance_ranges'),
  ('spec_mu61jwkg0ci967', 'Toyota', 'Yaris', 2011, 2020, '1.3 VVT-i', 'essence', 'Selon carnet constructeur', 3.6, 'Liquide longue durée', 'chaine', NULL, 'Bougies iridium', 90000, '["Bobines d’allumage","Sonde O2","Batterie"]', 'src_maintenance_ranges')
ON CONFLICT (id) DO NOTHING;

-- Annuaire de garages : faits déclarés, aucune notation de qualité par XAMOTO
-- 5 ligne(s)
-- Table : garages

INSERT INTO garages (id, name, city, country, lat, lon, phone, whatsapp, email, brands, specialties, equipment, services, opening_hours, verified, rating, accepts_xamoto, created_at) VALUES
  ('garage_mu61jwkg0dbl7g', 'Garage partenaire — Mécanique générale (exemple)', 'Dakar', 'SN', 14.7167, -17.4677, '+221 00 000 00 00', '+221 00 000 00 00', NULL, '["Toyota","Nissan","Hyundai"]', '["Mécanique moteur","Allumage","Distribution"]', '["Valise multimarque","Lecteur OBD-II","Multimètre","Compressiomètre"]', '["Diagnostic OBD","Remplacement bougies","Distribution"]', 'Lun–Sam 08:00–19:00', 1, 4.5, 1, '2026-09-17T21:28:05.536Z'),
  ('garage_mu61jwkg0fraec', 'Garage partenaire — Diesel & injection (exemple)', 'Dakar', 'SN', 14.7501, -17.4489, '+221 00 000 00 01', NULL, NULL, '["Peugeot","Renault","Mercedes-Benz","Ford"]', '["Diesel","Injecteurs","Filtre à particules","Turbo"]', '["Valise poids lourds/VP","Banc de test injecteurs","Endoscope"]', '["Diagnostic diesel","Nettoyage EGR","Réfection injecteurs"]', 'Lun–Ven 08:00–18:00', 1, 4.2, 1, '2026-09-17T21:28:05.536Z'),
  ('garage_mu61jwkg0gonqb', 'Garage partenaire — Électricité & climatisation (exemple)', 'Thiès', 'SN', 14.7886, -16.9246, '+221 00 000 00 02', '+221 00 000 00 02', NULL, '[]', '["Électricité automobile","Climatisation","Batterie","Démarreur"]', '["Testeur de batterie","Station de climatisation","Multimètre"]', '["Diagnostic électrique","Recharge climatisation","Alternateur"]', 'Lun–Sam 08:00–18:30', 0, 4.0, 1, '2026-09-17T21:28:05.536Z'),
  ('garage_mu61jwkg0h39sa', 'Garage partenaire — Freinage & train roulant (exemple)', 'Saint-Louis', 'SN', 16.0326, -16.4818, '+221 00 000 00 03', NULL, NULL, '[]', '["Freinage","ABS","Suspension","Direction"]', '["Banc de freinage","Valise ABS","Presse hydraulique"]', '["Plaquettes et disques","Diagnostic ABS","Amortisseurs"]', 'Lun–Sam 08:00–19:00', 1, 4.6, 1, '2026-09-17T21:28:05.536Z'),
  ('garage_mu61jwkg0ixtq7', 'Garage partenaire — Moteur & réfection (exemple)', 'Mbour', 'SN', 14.4198, -16.9646, '+221 00 000 00 04', NULL, NULL, '[]', '["Réfection moteur","Culasse","Joint de culasse","Distribution"]', '["Rectifieuse","Épreuve d’étanchéité","Outillage distribution"]', '["Réfection culasse","Joint de culasse","Moteur"]', 'Lun–Ven 08:00–18:00', 0, NULL, 1, '2026-09-17T21:28:05.536Z')
ON CONFLICT (id) DO NOTHING;

-- Prestations déclarées par les garages
-- 1 ligne(s)
-- Table : garage_services

INSERT INTO garage_services (id, garage_id, service, price_from, currency, duration_h) VALUES
  ('gservice_mu61jwkg0eky8e', 'garage_mu61jwkg0dbl7g', 'Diagnostic XAMOTO commenté', 5000.0, 'XOF', NULL)
ON CONFLICT (id) DO NOTHING;

-- Graphe de pièces : références, équivalents, compatibilités, prix indicatifs
-- 23 ligne(s)
-- Table : parts

INSERT INTO parts (id, part_key, name_fr, name_en, category, oem_references, equivalents, fits_brands, fits_engines, fits_year_from, fits_year_to, availability_sn, typical_price_xof, source_id, updated_at) VALUES
  ('part_mu61jwkg0jnm5o', 'bougie_allumage', 'Bougie d’allumage (iridium)', 'Spark plug (iridium)', 'allumage', '[]', '[]', '["Toyota","Hyundai","Kia","Nissan"]', '["1.6 VVT-i","1.6","1.4","1.5","1.3 VVT-i"]', NULL, NULL, 'high', 6000, 'src_garage_partner', '2026-09-17T21:28:21.658Z'),
  ('part_mu61jwkg0kxpo9', 'bobine_allumage', 'Bobine d’allumage', 'Ignition coil', 'allumage', '[]', '[]', '["Toyota","Hyundai","Kia"]', '["1.6 VVT-i","1.6","1.4"]', NULL, NULL, 'medium', 25000, 'src_garage_partner', '2026-09-17T21:28:21.658Z'),
  ('part_mu61jwkg0levq4', 'filtre_air', 'Filtre à air', 'Air filter', 'filtration', '[]', '[]', '[]', '[]', NULL, NULL, 'high', 7500, 'src_garage_partner', '2026-09-17T21:28:21.658Z'),
  ('part_mu61jwkh0mlvda', 'filtre_huile', 'Filtre à huile', 'Oil filter', 'filtration', '[]', '[]', '[]', '[]', NULL, NULL, 'high', 5000, 'src_garage_partner', '2026-09-17T21:28:21.658Z'),
  ('part_mu61jwkh0nll5o', 'filtre_carburant', 'Filtre à carburant (diesel)', 'Fuel filter (diesel)', 'filtration', '[]', '[]', '["Peugeot","Renault","Toyota","Mercedes-Benz"]', '["1.6 HDi","1.5 dCi","2.5 D-4D","C200 CDI"]', NULL, NULL, 'high', 12000, 'src_garage_partner', '2026-09-17T21:28:21.658Z'),
  ('part_mu61jwkh0o5fut', 'batterie_60ah', 'Batterie 60 Ah', 'Battery 60 Ah', 'electrique', '[]', '[]', '[]', '[]', NULL, NULL, 'high', 55000, 'src_garage_partner', '2026-09-17T21:28:21.658Z'),
  ('part_mu61jwkh0p6zwt', 'alternateur', 'Alternateur', 'Alternator', 'electrique', '[]', '[]', '[]', '[]', NULL, NULL, 'medium', 120000, 'src_garage_partner', '2026-09-17T21:28:21.658Z'),
  ('part_mu61jwkh0qjgbu', 'demarreur', 'Démarreur', 'Starter motor', 'electrique', '[]', '[]', '[]', '[]', NULL, NULL, 'medium', 85000, 'src_garage_partner', '2026-09-17T21:28:21.658Z'),
  ('part_mu61jwkh0ri593', 'sonde_o2_amont', 'Sonde O2 amont', 'Upstream O2 sensor', 'depollution', '[]', '[]', '[]', '[]', NULL, NULL, 'medium', 45000, 'src_garage_partner', '2026-09-17T21:28:21.658Z'),
  ('part_mu61jwkh0smrs0', 'catalyseur', 'Catalyseur', 'Catalytic converter', 'depollution', '[]', '[]', '[]', '[]', NULL, NULL, 'low', 260000, 'src_garage_partner', '2026-09-17T21:28:21.658Z'),
  ('part_mu61jwkh0tw2gx', 'vanne_egr', 'Vanne EGR', 'EGR valve', 'depollution', '[]', '[]', '[]', '[]', NULL, NULL, 'medium', 95000, 'src_garage_partner', '2026-09-17T21:28:21.659Z'),
  ('part_mu61jwkh0ue985', 'filtre_particules', 'Filtre à particules', 'Diesel particulate filter', 'depollution', '[]', '[]', '["Peugeot","Renault"]', '["1.6 HDi","1.5 dCi"]', NULL, NULL, 'low', 300000, 'src_garage_partner', '2026-09-17T21:28:21.659Z'),
  ('part_mu61jwkh0vb36q', 'debitmetre', 'Débitmètre d’air', 'Mass air flow sensor', 'admission', '[]', '[]', '[]', '[]', NULL, NULL, 'medium', 65000, 'src_garage_partner', '2026-09-17T21:28:21.659Z'),
  ('part_mu61jwkh0wuo5e', 'capteur_vilebrequin', 'Capteur de position vilebrequin', 'Crankshaft position sensor', 'allumage', '[]', '[]', '[]', '[]', NULL, NULL, 'medium', 35000, 'src_garage_partner', '2026-09-17T21:28:21.659Z'),
  ('part_mu61jwkh0xrjhv', 'thermostat', 'Thermostat', 'Thermostat', 'refroidissement', '[]', '[]', '[]', '[]', NULL, NULL, 'high', 18000, 'src_garage_partner', '2026-09-17T21:28:21.659Z'),
  ('part_mu61jwkh0ydmt0', 'pompe_a_eau', 'Pompe à eau', 'Water pump', 'refroidissement', '[]', '[]', '[]', '[]', NULL, NULL, 'medium', 55000, 'src_garage_partner', '2026-09-17T21:28:21.659Z'),
  ('part_mu61jwkh0z7rg5', 'durite_radiateur', 'Durite de radiateur', 'Radiator hose', 'refroidissement', '[]', '[]', '[]', '[]', NULL, NULL, 'medium', 20000, 'src_garage_partner', '2026-09-17T21:28:21.659Z'),
  ('part_mu61jwkh10eg6m', 'plaquettes_frein', 'Jeu de plaquettes de frein avant', 'Front brake pad set', 'freinage', '[]', '[]', '[]', '[]', NULL, NULL, 'high', 25000, 'src_garage_partner', '2026-09-17T21:28:21.659Z'),
  ('part_mu61jwkh11d64e', 'disque_frein', 'Disque de frein avant', 'Front brake disc', 'freinage', '[]', '[]', '[]', '[]', NULL, NULL, 'medium', 35000, 'src_garage_partner', '2026-09-17T21:28:21.659Z'),
  ('part_mu61jwkh12r1pm', 'capteur_abs', 'Capteur ABS de roue', 'Wheel speed sensor', 'freinage', '[]', '[]', '[]', '[]', NULL, NULL, 'medium', 30000, 'src_garage_partner', '2026-09-17T21:28:21.659Z'),
  ('part_mu61jwkh138kdb', 'huile_moteur_5w40', 'Huile moteur 5W-40 (5 L)', 'Engine oil 5W-40 (5 L)', 'consommable', '[]', '[]', '[]', '[]', NULL, NULL, 'high', 25000, 'src_garage_partner', '2026-09-17T21:28:21.659Z'),
  ('part_mu61jwkh140qb5', 'liquide_refroidissement', 'Liquide de refroidissement (5 L)', 'Coolant (5 L)', 'consommable', '[]', '[]', '[]', '[]', NULL, NULL, 'high', 12000, 'src_garage_partner', '2026-09-17T21:28:21.659Z'),
  ('part_mu61jwkh15vi4s', 'gaz_clim_r134a', 'Recharge gaz de climatisation R134a', 'A/C refrigerant charge R134a', 'climatisation', '[]', '[]', '[]', '[]', NULL, NULL, 'medium', 25000, 'src_garage_partner', '2026-09-17T21:28:21.659Z')
ON CONFLICT (id) DO NOTHING;

COMMIT;
