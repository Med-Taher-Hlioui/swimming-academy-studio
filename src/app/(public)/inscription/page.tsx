import type { Metadata } from "next";
import { publicSiteConfig } from "@/config/public-site";
import { whatsappLink } from "@/features/public-site/contact-links";
import { PublicMotion } from "@/features/public-site/public-motion";
import { registrationContent as content } from "@/features/public-site/registration-content";
import styles from "@/features/public-site/registration.module.css";

export const metadata: Metadata = {
  title: { absolute: content.title },
  description: content.introduction,
  robots: { index: false, follow: true },
};

function RegistrationAccordion({ items }: { items: { title: string; description: string }[] }) {
  return <div className={styles.accordion}>
    {items.map(item => <details key={item.title}>
      <summary>{item.title}</summary>
      <p>{item.description}</p>
    </details>)}
  </div>;
}

export default function RegistrationPage() {
  const enquiry = whatsappLink(publicSiteConfig.contact.whatsappNumber, content.enquiry);
  const contactLink = enquiry && <a data-registration-whatsapp className={styles.action} href={enquiry} target="_blank" rel="noopener noreferrer">
    {content.action} <span aria-hidden="true">↗</span>
  </a>;

  return <article className={styles.registration} data-public-registration>
    <PublicMotion />
    <header className={styles.intro}>
      <div className={styles.container} data-reveal-group data-reveal="fade">
        <h1>{content.title}</h1>
        <p>{content.introduction}</p>
        <p>L’inscription se finalise en personne auprès de l’académie.</p>
        {contactLink}
      </div>
    </header>
    <div className={styles.container}>
      <section className={styles.section} aria-labelledby="registration-steps" data-reveal-group data-reveal="up">
        <h2 id="registration-steps">Comment s’inscrire ?</h2>
        <p>Voici un guide pour préparer votre échange avec l’académie.</p>
        <ol className={styles.steps}>
          {content.steps.map(step => <li key={step.title}><h3>{step.title}</h3><p>{step.description}</p></li>)}
        </ol>
      </section>

      <section className={`${styles.section} ${styles.checklist}`} aria-labelledby="registration-documents" data-reveal-group data-reveal="up">
        <h2 id="registration-documents">Documents à préparer</h2>
        <p id="registration-checklist-help">Cochez les éléments à mesure que vous les préparez. Présentez les documents en personne. Les cases servent uniquement d’aide-mémoire sur cette page.</p>
        <fieldset aria-labelledby="registration-documents" aria-describedby="registration-checklist-help">
          {content.documents.map(document => <label key={document}>
            <input type="checkbox" autoComplete="off" />
            <span>{document}</span>
          </label>)}
        </fieldset>
      </section>

      <section className={styles.section} aria-labelledby="registration-practical" data-reveal-group data-reveal="up">
        <h2 id="registration-practical">Informations pratiques</h2>
        <div className={styles.practical}>
          {content.practical.map(item => <div key={item.title}><h3>{item.title}</h3><p>{item.description}</p></div>)}
        </div>
        <p>Les rappels et changements d’horaires sont communiqués par WhatsApp.</p>
      </section>

      <section className={styles.section} aria-labelledby="registration-rules" data-reveal-group data-reveal="up">
        <h2 id="registration-rules">Règlement intérieur</h2>
        <p>Ce résumé présente les repères pratiques. Demandez le règlement officiel à l’équipe lors de votre inscription.</p>
        <RegistrationAccordion items={content.rules} />
      </section>

      <section className={styles.section} aria-labelledby="registration-payment" data-reveal-group data-reveal="up">
        <h2 id="registration-payment">Politique de paiement</h2>
        <p>{content.payment}</p>
        <p>{content.paymentTiming}</p>
      </section>

      <section className={styles.section} aria-labelledby="registration-faq" data-reveal-group data-reveal="up">
        <h2 id="registration-faq">Questions fréquentes</h2>
        <RegistrationAccordion items={content.faq} />
      </section>

      <section className={`${styles.section} ${styles.contact}`} aria-labelledby="registration-next" data-reveal-group data-reveal="fade">
        <h2 id="registration-next">Contact et prochaines étapes</h2>
        <p>L’équipe vous renseignera sur les places disponibles et les formalités. Présentez vos documents en personne lors de l’inscription. Une demande d’informations ne réserve pas de place.</p>
        {contactLink}
      </section>
    </div>
  </article>;
}
