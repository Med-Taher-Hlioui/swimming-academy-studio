import type { ContentGenerationProvider, ContentLanguage, Objective, Platform, ThreeExamples } from "./models";
import { validateBrief } from "./rules";

type Triple = [string, string, string];
interface ObjectiveTemplate { hooks: Triple; angle: string; ctas: Triple }
interface LocaleTemplates {
  objectives: Record<Objective, ObjectiveTemplate>;
  intros: Triple;
  platforms: Record<Platform, string>;
}
const templates: Record<ContentLanguage, LocaleTemplates> = {
  en: {
    intros: ["In this lesson or event", "A moment to explore together", "Behind this swimming activity"],
    platforms: {
      Instagram: "What would you like to discover next? #Swimming #PoolLearning",
      Facebook: "What questions would you like to ask our team?",
      TikTok: "One activity, one short story. What would you try first?",
    },
    objectives: {
      awareness: {
        hooks: ["A new swimming story starts here.", "Discover a moment by the pool.", "Make room for a little swimming inspiration."],
        angle: "Discover the activity and the ideas behind it.",
        ctas: ["Follow for more swimming stories.", "Save this idea for your next pool visit.", "Share this activity with someone curious about swimming."],
      },
      education: {
        hooks: ["One swimming idea to explore today.", "Small steps make a lesson worth exploring.", "What can we learn from a pool activity?"],
        angle: "Ask a qualified coach how to adapt practice to the swimmer’s level.",
        ctas: ["Save this topic to discuss with a coach.", "Which part would you like explained next?", "Ask our team about the learning steps."],
      },
      "parent-trust": {
        hooks: ["Good questions belong beside the pool.", "Parents deserve a clear picture of a lesson.", "Start the conversation before the first splash."],
        angle: "Ask about supervision, lesson structure and how progress is discussed with families.",
        ctas: ["Send the team your questions about lessons.", "Ask how a session is organized.", "Save these questions for a conversation with a coach."],
      },
      registrations: {
        hooks: ["Curious about a swimming lesson?", "Thinking about your next step in swimming?", "Explore a swimming activity that interests you."],
        angle: "Enquire about suitable levels, schedules and current availability before making plans.",
        ctas: ["Contact the academy to ask about registration.", "Ask which group could suit your level.", "Request details about the next steps to register."],
      },
    },
  },
  fr: {
    intros: ["Au programme de cette séance ou de cet événement", "Un moment à découvrir ensemble", "Les coulisses de cette activité aquatique"],
    platforms: {
      Instagram: "Que souhaitez-vous découvrir ensuite ? #Natation #Apprentissage",
      Facebook: "Quelles questions aimeriez-vous poser à notre équipe ?",
      TikTok: "Une activité, une courte histoire. Par quoi commenceriez-vous ?",
    },
    objectives: {
      awareness: {
        hooks: ["Une nouvelle histoire de natation commence ici.", "Découvrez un moment au bord du bassin.", "Un peu d’inspiration pour votre prochaine séance."],
        angle: "Découvrez cette activité et les idées qui l’accompagnent.",
        ctas: ["Suivez la page pour découvrir d’autres activités.", "Enregistrez cette idée pour votre prochaine visite.", "Partagez cette activité avec une personne curieuse de natation."],
      },
      education: {
        hooks: ["Une idée de natation à explorer aujourd’hui.", "Apprendre commence par de petites étapes.", "Que peut-on découvrir pendant une séance ?"],
        angle: "Demandez à un coach qualifié comment adapter la pratique au niveau du nageur.",
        ctas: ["Gardez ce sujet pour en parler avec un coach.", "Quelle étape aimeriez-vous mieux comprendre ?", "Posez vos questions sur les étapes d’apprentissage."],
      },
      "parent-trust": {
        hooks: ["Les bonnes questions ont leur place au bord du bassin.", "Comprendre une séance, c’est pouvoir en parler.", "Avant la première séance, ouvrons la discussion."],
        angle: "Renseignez-vous sur l’encadrement, le déroulement des séances et le suivi avec les familles.",
        ctas: ["Envoyez vos questions à l’équipe.", "Demandez comment une séance est organisée.", "Gardez ces questions pour votre échange avec le coach."],
      },
      registrations: {
        hooks: ["Envie de découvrir une séance de natation ?", "Vous envisagez de commencer la natation ?", "Explorez une activité qui vous donne envie."],
        angle: "Renseignez-vous sur les niveaux, les horaires et les disponibilités avant de vous organiser.",
        ctas: ["Contactez l’académie pour les modalités d’inscription.", "Demandez quel groupe correspond à votre niveau.", "Demandez les étapes à suivre pour vous inscrire."],
      },
    },
  },
  aeb: {
    intros: ["في الحصّة ولا النشاط هذا", "لحظة نكتشفوها مع بعضنا", "من كواليس النشاط في المسبح"],
    platforms: {
      Instagram: "شنوّة تحبّوا تكتشفوا المرّة الجاية؟ #سباحة #تعلّم",
      Facebook: "شنوّة الأسئلة اللي تحبّوا تسألوها للفريق؟",
      TikTok: "نشاط واحد وحكاية قصيرة. بشنوّة تحبّوا تبدؤوا؟",
    },
    objectives: {
      awareness: {
        hooks: ["حكاية سباحة جديدة تبدأ من هنا.", "اكتشفوا معانا لحظة في المسبح.", "فكرة جديدة لحصّتكم الجاية في المسبح."],
        angle: "اكتشفوا النشاط والفكرة اللي وراه.",
        ctas: ["تابعوا الصفحة باش تكتشفوا أنشطة أخرى.", "سجّلوا الفكرة للمرّة الجاية.", "شاركوا النشاط مع شكون يحبّ يكتشف السباحة."],
      },
      education: {
        hooks: ["فكرة سباحة نتعلّموها اليوم.", "التعلّم يبدأ بخطوات صغيرة.", "شنوّة نجموا نتعلّموا في حصّة سباحة؟"],
        angle: "اسألوا مدرّب مختصّ كيفاش التمرين يتكيّف مع مستوى السبّاح.",
        ctas: ["سجّلوا الموضوع باش تحكيو فيه مع المدرّب.", "شنوّة الخطوة اللي تحبّوا تفهموها أكثر؟", "اسألوا الفريق على مراحل التعلّم."],
      },
      "parent-trust": {
        hooks: ["أسئلتكم عندها بلاصتها على حافة المسبح.", "كل وليّ من حقّه يفهم كيفاش تدور الحصّة.", "قبل أوّل حصّة، خلّينا نحكيو."],
        angle: "اسألوا على التأطير وتنظيم الحصص وكيفاش يصير التواصل مع العايلات.",
        ctas: ["ابعثوا أسئلتكم للفريق.", "اسألوا كيفاش تتنظّم الحصّة.", "سجّلوا الأسئلة باش تحكيو فيها مع المدرّب."],
      },
      registrations: {
        hooks: ["تحبّوا تكتشفوا حصّة سباحة؟", "تفكّروا تبدؤوا السباحة؟", "اكتشفوا نشاط سباحة يهمّكم."],
        angle: "اسألوا على المستويات والتوقيت والبلايص المتوفّرة قبل ما تبرمجوا.",
        ctas: ["اتّصلوا بالأكاديمية واسألوا على التسجيل.", "اسألوا على المجموعة اللي تناسب مستواكم.", "اطلبوا تفاصيل على خطوات التسجيل."],
      },
    },
  },
};

export const templateGenerationProvider: ContentGenerationProvider = {
  info: { id: "templates-v1", label: "Demo Generator", mode: "template" },
  async generate(input) {
    const brief = validateBrief(input);
    const locale = templates[brief.language];
    const objective = locale.objectives[brief.objective];
    return [0, 1, 2].map(index => ({
      hook: objective.hooks[index],
      caption: `${locale.intros[index]} : ${brief.description}\n\n${objective.angle}\n\n${locale.platforms[brief.platform]}`,
      cta: objective.ctas[index],
    })) as ThreeExamples;
  },
};
