import type { TrialRequestCopy } from "../features/public-site/trial-request-model";

/** Owner-editable public content. Never derive these fields from fictional workspace records. */
export interface PublicSectionCopy { eyebrow: string; title: string; description: string }
export interface PublicSiteConfig {
  brand: { name: string; tagline: string; primaryColor: string; descriptor: string; logo: { src: string; width: number; height: number; alt: string } | null };
  preview: boolean;
  trial: TrialRequestCopy;
  language: string;
  metadata: { title: string; description: string };
  navigation: { programs: string; team: string; contact: string; workspace: string; label: string; skip: string };
  notice: string;
  hero: { eyebrow: string; description: string; primaryAction: string; secondaryAction: string; artCaption: string; artNote: string };
  programSection: PublicSectionCopy & { placeholderLabel: string; detailsLabel: string; pendingDetails: string; action: string; empty: string };
  teamSection: PublicSectionCopy & { emptyTitle: string; emptyDescription: string; placeholderLabel: string };
  contactSection: PublicSectionCopy & { emailLabel: string; phoneLabel: string; addressLabel: string; pending: string; privacyNote: string; externalNote: string; directionsLabel: string };
  social: { instagramLabel: string; instagramPending: string; whatsappLabel: string; whatsappPending: string };
  footer: { note: string; backToTop: string };
  contact: { email: string | null; phone: string | null; address: string | null; instagramUrl: string | null; whatsappNumber: string | null; whatsappMessage: string; mapsUrl: string | null };
  programs: { id: string; title: string; description: string; focus: string; placeholder: boolean }[];
  coaches: { id: string; name: string; biography: string; placeholder: boolean; photo?: { src: string; width: number; height: number; position: string } }[];
}

export const publicSiteConfig: PublicSiteConfig = {
  // Original media remains local while this development Preview uses neutral placeholders.
  brand: { name: "Shark Aquatics", tagline: "Apprenez. Progressez. Nagez.", primaryColor: "#066398", descriptor: "Académie de natation", logo: null },
  preview: true,
  trial: {
    freeLabel: "Séance d'essai gratuite", scheduleLabel: "Horaires selon les disponibilités",
    title: "Préparez votre demande d’essai.",
    description: "Choisissez simplement le public et le niveau estimé pour demander les horaires disponibles à l’académie.",
    audienceLabel: "Pour qui ?", audiencePrompt: "Choisir le public", levelLabel: "Niveau de natation estimé",
    classificationNote: "Ces niveaux servent à préciser votre demande. Ils ne désignent pas des catégories de groupes officiellement proposées.",
    action: "Demander les disponibilités sur WhatsApp", selectNotice: "Choisissez le public pour préparer le message. Si le niveau est inconnu, conservez « Je ne sais pas ».",
    privacyNote: "Aucun nom, âge précis, téléphone, e-mail ou autre détail personnel n’est demandé. Vos choix ne sont pas enregistrés par ce site.",
    disclaimer: "Le lien ouvre WhatsApp dans un nouvel onglet. Vous choisissez d’envoyer le message. Aucun créneau n’est réservé ou confirmé ici.",
    unavailable: "Le lien WhatsApp est indisponible. Consultez les coordonnées de l’académie.",
    message: {
      opening: "Bonjour, je souhaite demander une séance d'essai gratuite chez Shark Aquatics.",
      audienceLabel: "Public", levelLabel: "Niveau estimé",
      availability: "Quels horaires pouvez-vous proposer pour cette séance d’essai, selon les disponibilités ?",
    },
  },
  language: "fr",
  metadata: { title: "Shark Aquatics — Natation pour enfants et adultes", description: "Natation pour les enfants dès 3 ans et les adultes, tous niveaux, à la piscine de l’Hotel Liberty Resort. Demandez une séance d’essai gratuite via WhatsApp, selon les disponibilités." },
  navigation: { programs: "Natation", team: "L’équipe", contact: "Contact & accès", workspace: "Espace démo", label: "Navigation publique", skip: "Aller au contenu" },
  notice: "Aperçu pour validation par l’académie · Site non lancé",
  hero: { eyebrow: "Shark Aquatics · Académie de natation", description: "Des programmes de natation pour les enfants dès 3 ans et les adultes. Tous les niveaux sont les bienvenus à la piscine de l’Hotel Liberty Resort.", primaryAction: "Séance d'essai gratuite", secondaryAction: "Nos programmes", artCaption: "Trouvez votre rythme dans l’eau.", artNote: "Illustration de l’eau — ce visuel ne représente pas la piscine." },
  programSection: { eyebrow: "À chacun son point de départ", title: "La natation pour petits et grands.", description: "Enfants dès 3 ans et adultes : Shark Aquatics accueille tous les niveaux. Les programmes sont organisés par groupe d’âge et niveau de natation.", placeholderLabel: "Information à confirmer", detailsLabel: "Séance d'essai gratuite", pendingDetails: "Horaires selon les disponibilités. Demandez les créneaux proposés par l’académie ; aucune réservation n’est confirmée sur ce site.", action: "Séance d'essai gratuite", empty: "Contactez l’académie pour découvrir ses programmes de natation." },
  teamSection: { eyebrow: "L’équipe Shark Aquatics", title: "Des nageurs à vos côtés.", description: "Découvrez les membres de l’équipe et leurs parcours.", emptyTitle: "Notre équipe", emptyDescription: "Les profils de l’équipe seront ajoutés après validation.", placeholderLabel: "Profil à confirmer" },
  contactSection: { eyebrow: "Contact & accès", title: "Parlons de votre séance d’essai gratuite.", description: "Retrouvez-nous à la piscine de l’Hotel Liberty Resort. Les horaires sont variables, selon les disponibilités. Préparez votre demande puis échangez avec l’académie sur WhatsApp.", emailLabel: "E-mail", phoneLabel: "WhatsApp", addressLabel: "Piscine", pending: "À confirmer par l’académie", privacyNote: "Aucun formulaire de réservation ou d’inscription sur ce site. Une demande d’informations ne constitue pas une réservation.", externalNote: "WhatsApp et Google Maps s’ouvrent dans un nouvel onglet. Aucun message n’est envoyé automatiquement.", directionsLabel: "Voir l’itinéraire sur Google Maps" },
  social: { instagramLabel: "Découvrir notre Instagram", instagramPending: "Instagram · profil officiel à confirmer", whatsappLabel: "Séance d'essai gratuite", whatsappPending: "WhatsApp · numéro à confirmer" },
  footer: { note: "Natation pour enfants dès 3 ans et adultes · Tous niveaux", backToTop: "Retour en haut" },
  contact: {
    email: null, phone: "+216 50 765 765", address: "Piscine de l’Hotel Liberty Resort", instagramUrl: null,
    whatsappNumber: "21650765765",
    whatsappMessage: "Bonjour, je souhaite demander une séance d'essai gratuite chez Shark Aquatics. Quels horaires sont disponibles ?",
    mapsUrl: "https://www.google.com/maps?q=Hotel+Liberty+Resort,+Bp+122+Skanes,+5000&ftid=0x13020ca4a6919e89:0xcc1f14736f46a62a&entry=gps",
  },
  // These cards describe the approved audience, not invented lesson categories.
  programs: [
    { id: "children", title: "Enfants dès 3 ans", focus: "Enfants", description: "Des programmes de natation ouverts aux enfants à partir de 3 ans.", placeholder: false },
    { id: "adults", title: "Adultes", focus: "Adultes", description: "Les adultes sont également les bienvenus chez Shark Aquatics.", placeholder: false },
    { id: "all-levels", title: "Tous les niveaux", focus: "Natation", description: "Tous les niveaux de natation sont accueillis au sein de l’académie.", placeholder: false },
  ],
  coaches: [
    { id: "mehdi", name: "Coach Mehdi", biography: "Fondateur et propriétaire de l’académie, ancien nageur.", placeholder: false },
    { id: "hatem", name: "Coach Hatem", biography: "Ancien nageur et entraîneur de natation certifié.", placeholder: false },
    { id: "taher", name: "Coach Taher", biography: "Ancien nageur, titulaire d’un brevet fédéral et développeur de l’application web.", placeholder: false },
    { id: "mehdi-b", name: "Coach Mehdi B", biography: "Coach de l’académie.", placeholder: false },
  ],
};

/** V0.3 editorial direction and asset slots, subject to owner review. */
export const publicDesignCopy = {
  links: [
    { href: "/#programs", label: "Programmes" },
    { href: "/#story", label: "L’esprit Shark" },
    { href: "/#team", label: "L’équipe" },
    { href: "/#contact", label: "Nous trouver" },
    { href: "/inscription", label: "Inscription" },
  ],
  heroPhoto: "Votre prochain chapitre commence dans l’eau.",
  photoPending: "Photographie de l’académie à venir",
  sharkAsset: null as string | null,
  sharkNote: "Logo original · Animation en attente du requin détouré officiel",
  explorer: {
    photoNote: "Des moments d’apprentissage à l’académie · Les images illustrent la natation, indépendamment du public ou du niveau sélectionné.",
    title: "Quel est votre point de départ ?", levelLabel: "Votre niveau estimé",
    action: "Parlons de votre programme", visual: "À chacun son rythme.",
    descriptions: {
      child: "À partir de 3 ans, avec une organisation par groupe d’âge et niveau de natation.",
      adult: "Les adultes sont les bienvenus, quel que soit leur niveau de natation.",
      unknownLevel: "Vous pouvez demander conseil à l’académie pour préciser le niveau.",
      selectedLevel: "Votre demande précisera le niveau estimé",
    },
    note: "Les groupes sont organisés par âge et niveau. Ces choix précisent votre demande. L’académie vous orientera selon les disponibilités.",
    opening: "Bonjour, je souhaite des informations sur les programmes de natation chez Shark Aquatics.",
    availability: "Pouvez-vous m’indiquer les possibilités pour ce public et ce niveau, selon les disponibilités ?",
  },
  story: {
    eyebrow: "L’esprit Shark Aquatics", title: "Le plaisir d’oser. L’envie de continuer.",
    description: "Entrer dans l’eau, trouver ses repères, avoir envie de revenir. Une histoire de natation se construit à son rythme, enfant comme adulte.",
    values: [
      { title: "Plaisir", text: "Retrouver le goût de l’eau et le plaisir du mouvement." },
      { title: "Confiance", text: "Oser un premier pas, puis un autre, à son rythme." },
      { title: "Progression", text: "Se donner l’envie d’aller un peu plus loin." },
      { title: "Attention", text: "Prendre le temps d’échanger sur votre point de départ et vos attentes." },
    ],
    note: "Notre esprit en quelques mots · Texte de présentation proposé pour validation",
    photo: "Des moments à partager, dans l’eau.",
  },
  portraitPending: "Portrait officiel à venir",
  trialPhoto: "Un premier plongeon dans votre aventure.",
  location: {
    eyebrow: "Rendez-vous au bord de l’eau", title: "Retrouvez-nous à la piscine",
    description: "La piscine de l’Hotel Liberty Resort, dans la région de Monastir, en Tunisie. Échangez avec l’académie pour connaître les horaires disponibles.",
    photo: "La piscine de l’Hotel Liberty Resort", mapNote: "La carte indique l’hôtel. L’accès précis à la piscine est à confirmer avec l’académie.",
  },
  copyrightYear: 2026,
  copyright: "Shark Aquatics. Tous droits réservés.",
};

export const publicVenue = {
  name: "Hotel Liberty Resort",
  address: "BP 122, Skanes, 5000, Monastir, Tunisia.",
  destination: "Hotel Liberty Resort, BP 122 Skanes, 5000, Monastir, Tunisia",
  featureId: "0x13020ca4a6919e89:0xcc1f14736f46a62a",
  // Confirmed against Google's public response for the owner-provided hotel feature.
  embedCoordinates: "35.7671468,10.7198879",
  directionsLabel: "Obtenir l’itinéraire",
  loadMapLabel: "Afficher la carte interactive",
  mapTitle: "Carte Google Maps — Hotel Liberty Resort, Skanes, Monastir",
  mapNotice: "La carte est fournie par Google Maps et se charge uniquement à votre demande.",
  mapFallback: "Si la carte reste vide ou est bloquée, ouvrez la destination directement dans Google Maps.",
};
