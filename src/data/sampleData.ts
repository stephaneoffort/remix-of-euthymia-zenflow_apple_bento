import { Space, Project, TaskList, Task, TeamMember } from '@/types';

export const TEAM_MEMBERS: TeamMember[] = [
  { id: 'tm1', name: 'Stéphane Faure', role: 'Directeur', avatarColor: '#0F766E', email: 'stephane.faure@euthymia.fr' },
  { id: 'tm2', name: 'Stéphane Offort', role: 'Coordinateur', avatarColor: '#7C3AED', email: 'stephane.offort@euthymia.fr' },
  { id: 'tm3', name: 'Julien Cazabonne', role: 'Formateur', avatarColor: '#2563EB', email: 'julien@euthymia.fr' },
  { id: 'tm4', name: 'Cécile', role: 'Assistante', avatarColor: '#DB2777', email: 'cecile@euthymia.fr' },
  { id: 'tm5', name: 'Sébastien', role: 'Communication', avatarColor: '#EA580C', email: 'sebastien@euthymia.fr' },
];

export const SPACES: Space[] = [
  { id: 'sp1', name: 'Euthymia', icon: '🧘', order: 0 },
  { id: 'sp2', name: 'Formations', icon: '📚', order: 1 },
  { id: 'sp3', name: 'Communication', icon: '📢', order: 2 },
  { id: 'sp4', name: 'Admin', icon: '⚙️', order: 3 },
];

export const PROJECTS: Project[] = [
  { id: 'p1', name: 'Programme MBSR 2026', spaceId: 'sp2', color: '#0F766E', order: 0 },
  { id: 'p2', name: 'Formation OPALE', spaceId: 'sp2', color: '#7C3AED', order: 1 },
  { id: 'p3', name: 'Communication Digitale', spaceId: 'sp3', color: '#2563EB', order: 0 },
  { id: 'p4', name: 'Admin & RH', spaceId: 'sp4', color: '#EA580C', order: 0 },
  { id: 'p5', name: 'Retraites', spaceId: 'sp1', color: '#059669', order: 0 },
];

export const LISTS: TaskList[] = [
  { id: 'l1', name: 'À faire', projectId: 'p1', order: 0 },
  { id: 'l2', name: 'En cours', projectId: 'p1', order: 1 },
  { id: 'l3', name: 'En revue', projectId: 'p1', order: 2 },
  { id: 'l4', name: 'Terminé', projectId: 'p1', order: 3 },
  { id: 'l5', name: 'À faire', projectId: 'p2', order: 0 },
  { id: 'l6', name: 'En cours', projectId: 'p2', order: 1 },
  { id: 'l7', name: 'Terminé', projectId: 'p2', order: 2 },
  { id: 'l8', name: 'À faire', projectId: 'p3', order: 0 },
  { id: 'l9', name: 'En cours', projectId: 'p3', order: 1 },
  { id: 'l10', name: 'Terminé', projectId: 'p3', order: 2 },
  { id: 'l11', name: 'À faire', projectId: 'p4', order: 0 },
  { id: 'l12', name: 'En cours', projectId: 'p4', order: 1 },
  { id: 'l13', name: 'Terminé', projectId: 'p4', order: 2 },
  { id: 'l14', name: 'À faire', projectId: 'p5', order: 0 },
  { id: 'l15', name: 'En cours', projectId: 'p5', order: 1 },
  { id: 'l16', name: 'Terminé', projectId: 'p5', order: 2 },
];

const now = new Date();
const d = (days: number) => {
  const date = new Date(now);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
};

export const INITIAL_TASKS: Task[] = [
  // MBSR 2026 tasks
  {
    id: 't1', title: 'Finaliser le programme pédagogique MBSR 2026', description: 'Revoir les 8 séances du programme MBSR, intégrer les retours des participants 2025, et mettre à jour les supports de méditation guidée.', status: 'in_progress', priority: 'high', dueDate: d(7), startDate: d(-5), assigneeIds: ['tm1'], tags: ['pédagogie', 'MBSR'], parentTaskId: null, listId: 'l2', comments: [
      { id: 'c1', authorId: 'tm3', content: 'J\'ai commencé la révision des séances 1 à 4. Les exercices de body scan ont été mis à jour.', createdAt: d(-2) }
    ], attachments: [], timeEstimate: 480, timeLogged: 180, aiSummary: null, createdAt: d(-10), order: 0,
  },
  {
    id: 't2', title: 'Créer les supports de méditation guidée audio', description: 'Enregistrer 8 méditations guidées (body scan, marche méditative, pleine conscience des émotions) pour accompagner le programme.', status: 'todo', priority: 'normal', dueDate: d(14), startDate: d(3), assigneeIds: ['tm1', 'tm3'], tags: ['audio', 'méditation'], parentTaskId: null, listId: 'l1', comments: [], attachments: [], timeEstimate: 600, timeLogged: null, aiSummary: null, createdAt: d(-8), order: 1,
  },
  {
    id: 't3', title: 'Organiser la journée de silence', description: 'Planifier la journée intensive de pratique silencieuse entre la séance 6 et 7. Trouver un lieu adapté, préparer le programme détaillé.', status: 'todo', priority: 'normal', dueDate: d(30), startDate: null, assigneeIds: ['tm2'], tags: ['logistique', 'retraite'], parentTaskId: null, listId: 'l1', comments: [], attachments: [], timeEstimate: 240, timeLogged: null, aiSummary: null, createdAt: d(-5), order: 2,
  },
  {
    id: 't4', title: 'Mettre à jour le site web avec les dates 2026', description: 'Publier les nouvelles dates de formation sur le site euthymia.fr. Inclure les tarifs, les modalités d\'inscription et les témoignages.', status: 'done', priority: 'normal', dueDate: d(-3), startDate: d(-10), assigneeIds: ['tm5'], tags: ['web'], parentTaskId: null, listId: 'l4', comments: [
      { id: 'c2', authorId: 'tm5', content: 'Site mis à jour. Les pages MBSR et MBCT sont en ligne.', createdAt: d(-3) }
    ], attachments: [{ id: 'a1', name: 'capture-site.png', url: '#' }], timeEstimate: 120, timeLogged: 90, aiSummary: null, createdAt: d(-12), order: 0,
  },
  {
    id: 't5', title: 'Recruter les participants MBSR session printemps', description: 'Lancer la campagne d\'inscription pour la session de printemps. Objectif: 12 participants minimum.', status: 'in_progress', priority: 'urgent', dueDate: d(-2), startDate: d(-15), assigneeIds: ['tm4', 'tm2'], tags: ['inscription', 'urgent'], parentTaskId: null, listId: 'l2', comments: [
      { id: 'c3', authorId: 'tm4', content: '8 inscrits pour le moment. Il faut accélérer la communication.', createdAt: d(-1) }
    ], attachments: [], timeEstimate: 300, timeLogged: 200, aiSummary: null, createdAt: d(-15), order: 1,
  },
  // Subtasks for t1
  {
    id: 't1s1', title: 'Réviser les séances 1-4', description: 'Mettre à jour le contenu des séances d\'introduction, body scan, et pleine conscience.', status: 'done', priority: 'normal', dueDate: d(2), startDate: d(-5), assigneeIds: ['tm3'], tags: [], parentTaskId: 't1', listId: 'l2', comments: [], attachments: [], timeEstimate: 120, timeLogged: 120, aiSummary: null, createdAt: d(-10), order: 0,
  },
  {
    id: 't1s2', title: 'Réviser les séances 5-8', description: '', status: 'in_progress', priority: 'normal', dueDate: d(5), startDate: d(0), assigneeIds: ['tm1'], tags: [], parentTaskId: 't1', listId: 'l2', comments: [], attachments: [], timeEstimate: 120, timeLogged: 40, aiSummary: null, createdAt: d(-10), order: 1,
  },
  {
    id: 't1s3', title: 'Intégrer les retours participants 2025', description: '', status: 'todo', priority: 'high', dueDate: d(6), startDate: null, assigneeIds: ['tm1'], tags: [], parentTaskId: 't1', listId: 'l2', comments: [], attachments: [], timeEstimate: 60, timeLogged: null, aiSummary: null, createdAt: d(-10), order: 2,
  },
  // OPALE tasks
  {
    id: 't6', title: 'Préparer le module facilitateur OPALE', description: 'Développer le contenu du module de formation pour les facilitateurs. Inclure les compétences clés, les exercices pratiques et les grilles d\'évaluation.', status: 'in_progress', priority: 'high', dueDate: d(20), startDate: d(-3), assigneeIds: ['tm1', 'tm3'], tags: ['OPALE', 'formation'], parentTaskId: null, listId: 'l6', comments: [], attachments: [], timeEstimate: 960, timeLogged: 120, aiSummary: null, createdAt: d(-7), order: 0,
  },
  {
    id: 't7', title: 'Traduire les supports OPALE en français', description: 'Adapter les documents originaux en anglais pour le public francophone.', status: 'todo', priority: 'normal', dueDate: d(25), startDate: null, assigneeIds: ['tm3'], tags: ['traduction'], parentTaskId: null, listId: 'l5', comments: [], attachments: [], timeEstimate: 480, timeLogged: null, aiSummary: null, createdAt: d(-5), order: 0,
  },
  // Communication tasks
  {
    id: 't8', title: 'Rédiger la newsletter mensuelle', description: 'Newsletter de mars: actualités Euthymia, article sur la pleine conscience au travail, dates des prochaines formations.', status: 'in_review', priority: 'normal', dueDate: d(1), startDate: d(-5), assigneeIds: ['tm5'], tags: ['newsletter', 'contenu'], parentTaskId: null, listId: 'l9', comments: [
      { id: 'c4', authorId: 'tm5', content: 'Premier brouillon prêt. En attente de relecture par Stéphane.', createdAt: d(-1) }
    ], attachments: [], timeEstimate: 180, timeLogged: 150, aiSummary: null, createdAt: d(-7), order: 0,
  },
  {
    id: 't9', title: 'Créer les visuels Instagram pour mars', description: 'Préparer 12 posts Instagram: citations de pleine conscience, annonces formations, témoignages.', status: 'todo', priority: 'normal', dueDate: d(5), startDate: null, assigneeIds: ['tm5'], tags: ['social media', 'design'], parentTaskId: null, listId: 'l8', comments: [], attachments: [], timeEstimate: 360, timeLogged: null, aiSummary: null, createdAt: d(-3), order: 0,
  },
  {
    id: 't10', title: 'Tourner les vidéos témoignages participants', description: 'Organiser 3 entretiens vidéo avec d\'anciens participants pour le site web et les réseaux sociaux.', status: 'blocked', priority: 'high', dueDate: d(-5), startDate: d(-10), assigneeIds: ['tm5', 'tm2'], tags: ['vidéo', 'témoignages'], parentTaskId: null, listId: 'l9', comments: [
      { id: 'c5', authorId: 'tm2', content: 'Bloqué: en attente de confirmation des 3 participants pour les dates de tournage.', createdAt: d(-3) }
    ], attachments: [], timeEstimate: 480, timeLogged: 60, aiSummary: null, createdAt: d(-12), order: 1,
  },
  // Admin tasks
  {
    id: 't11', title: 'Préparer les contrats formateurs 2026', description: 'Rédiger et envoyer les contrats pour les intervenants externes du programme 2026.', status: 'in_progress', priority: 'urgent', dueDate: d(-1), startDate: d(-7), assigneeIds: ['tm4'], tags: ['RH', 'juridique'], parentTaskId: null, listId: 'l12', comments: [], attachments: [], timeEstimate: 240, timeLogged: 180, aiSummary: null, createdAt: d(-10), order: 0,
  },
  {
    id: 't12', title: 'Bilan financier T1 2026', description: 'Compiler les recettes et dépenses du premier trimestre. Préparer le rapport pour le conseil.', status: 'todo', priority: 'high', dueDate: d(10), startDate: null, assigneeIds: ['tm4'], tags: ['finance'], parentTaskId: null, listId: 'l11', comments: [], attachments: [], timeEstimate: 360, timeLogged: null, aiSummary: null, createdAt: d(-2), order: 0,
  },
  {
    id: 't13', title: 'Renouveler l\'assurance professionnelle', description: 'L\'assurance arrive à échéance le 15 avril. Comparer les offres et renouveler.', status: 'todo', priority: 'normal', dueDate: d(25), startDate: null, assigneeIds: ['tm4'], tags: ['admin'], parentTaskId: null, listId: 'l11', comments: [], attachments: [], timeEstimate: 60, timeLogged: null, aiSummary: null, createdAt: d(-1), order: 1,
  },
  // Retraites
  {
    id: 't14', title: 'Réserver le lieu pour la retraite d\'été', description: 'Contacter les centres de retraite dans le Sud-Ouest. Budget max: 5000€ pour 25 personnes, 5 jours.', status: 'in_progress', priority: 'high', dueDate: d(15), startDate: d(-5), assigneeIds: ['tm2'], tags: ['retraite', 'logistique'], parentTaskId: null, listId: 'l15', comments: [
      { id: 'c6', authorId: 'tm2', content: 'Deux centres ont répondu positivement. Visite prévue la semaine prochaine.', createdAt: d(-1) }
    ], attachments: [], timeEstimate: 180, timeLogged: 60, aiSummary: null, createdAt: d(-8), order: 0,
  },
  {
    id: 't15', title: 'Élaborer le programme de la retraite de 5 jours', description: 'Créer un programme jour par jour avec méditations, ateliers, temps libres et repas.', status: 'todo', priority: 'normal', dueDate: d(30), startDate: null, assigneeIds: ['tm1'], tags: ['retraite', 'programme'], parentTaskId: null, listId: 'l14', comments: [], attachments: [], timeEstimate: 300, timeLogged: null, aiSummary: null, createdAt: d(-4), order: 0,
  },
  {
    id: 't16', title: 'Organiser le transport des participants', description: 'Étudier les options de covoiturage et navette depuis Bordeaux pour la retraite.', status: 'todo', priority: 'low', dueDate: d(40), startDate: null, assigneeIds: ['tm2'], tags: ['logistique'], parentTaskId: null, listId: 'l14', comments: [], attachments: [], timeEstimate: 120, timeLogged: null, aiSummary: null, createdAt: d(-2), order: 1,
  },
  // Deep subtask for t1s2
  {
    id: 't1s2a', title: 'Revoir l\'exercice de marche méditative (séance 7)', description: '', status: 'todo', priority: 'normal', dueDate: d(4), startDate: null, assigneeIds: ['tm1'], tags: [], parentTaskId: 't1s2', listId: 'l2', comments: [], attachments: [], timeEstimate: 30, timeLogged: null, aiSummary: null, createdAt: d(-8), order: 0,
  },
];
