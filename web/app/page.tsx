"use client";

import { useCallback, useEffect, useState } from "react";
import { LandingStickyHeader } from "./components/LandingStickyHeader";
import styles from "./landing.module.css";

const PHONE_DISPLAY = "(850) 420-7731";
const PHONE_TEL = "tel:+18504207731";
const EMAIL = "kari.pastrana@novushomemortgage.com";

const STORAGE_KEY = "site_language";

type Lang = "en" | "es";

const translations: Record<
  Lang,
  {
    heroBrand: string;
    heroTitle: string;
    heroSubtitle: string;
    applyButton: string;
    callButton: string;
    contact: string;
    trustTitle: string;
    trust1Title: string;
    trust1Text: string;
    trust2Title: string;
    trust2Text: string;
    trust3Title: string;
    trust3Text: string;
    aboutTitle: string;
    aboutP1Before: string;
    aboutP1After: string;
    aboutP2: string;
    loanProgramsTitle: string;
    loanProgramsIntro: string;
    bestForLabel: string;
    program1Title: string;
    program1Desc: string;
    program1BestFor: string;
    program2Title: string;
    program2Desc: string;
    program2BestFor: string;
    program3Title: string;
    program3Desc: string;
    program3BestFor: string;
    howItWorksTitle: string;
    step1Title: string;
    step1Text: string;
    step2Title: string;
    step2Text: string;
    step3Title: string;
    step3Text: string;
    ctaTitle: string;
    ctaSubBefore: string;
    ctaSubOr: string;
    ctaSubAfter: string;
    preferredLender: string;
    photoAlt: string;
    nmlsPhoto: string;
  }
> = {
  en: {
    heroBrand: "Kari Pastrana · Preferred Lender",
    heroTitle: "Simple, Stress-Free Home Financing",
    heroSubtitle:
      "Helping you get approved with the right loan — traditional, Non-QM, and DSCR options available nationwide.",
    applyButton: "Apply Now",
    callButton: "Call Now",
    contact: "Contact",
    trustTitle: "Why work with Kari",
    trust1Title: "Preferred Lender",
    trust1Text: "Trusted guidance from a dedicated mortgage professional.",
    trust2Title: "Nationwide",
    trust2Text: "Licensed to help clients in all 50 states.",
    trust3Title: "Loan flexibility",
    trust3Text: "Traditional, Non-QM, and DSCR programs to fit real-life situations.",
    aboutTitle: "About Kari",
    aboutP1Before: "My name is Karithlyn Pastrana — you can call me ",
    aboutP1After:
      ". I focus on clear answers, steady communication, and loans that match how you actually earn and buy.",
    aboutP2:
      "Whether you're purchasing, refinancing, or investing, I'm here to simplify the process and help you feel confident from application to closing.",
    loanProgramsTitle: "Loan programs",
    loanProgramsIntro: "Options designed for everyday buyers, unique income stories, and investors.",
    bestForLabel: "Best for",
    program1Title: "Traditional loans",
    program1Desc: "Conventional and government-backed paths with competitive terms.",
    program1BestFor: "W-2 employees, strong credit, standard documentation.",
    program2Title: "Non-QM loans",
    program2Desc: "Flexible underwriting when tax returns don't tell the whole story.",
    program2BestFor: "Self-employed borrowers and non-traditional income.",
    program3Title: "DSCR / investor loans",
    program3Desc: "Rental income and property cash flow considered for investment purchases.",
    program3BestFor: "Real estate investors building or scaling a portfolio.",
    howItWorksTitle: "How it works",
    step1Title: "Apply online",
    step1Text: "Start your application securely — it only takes a few minutes.",
    step2Title: "Get pre-approved",
    step2Text: "Know your buying power and loan options with a clear plan.",
    step3Title: "Close with confidence",
    step3Text: "Stay informed through underwriting to the closing table.",
    ctaTitle: "Ready to get started?",
    ctaSubBefore: "Take the next step toward pre-approval — or reach Kari at ",
    ctaSubOr: " or ",
    ctaSubAfter: ".",
    preferredLender: "Preferred Lender",
    photoAlt: "Kari Pastrana, loan officer",
    nmlsPhoto: "NMLS# 2745146",
  },
  es: {
    heroBrand: "Kari Pastrana · Prestamista preferida",
    heroTitle: "Financiamiento de vivienda simple y sin estrés",
    heroSubtitle:
      "Le ayudamos a obtener la aprobación con el préstamo adecuado: tradicional, Non-QM y DSCR disponibles en todo el país.",
    applyButton: "Aplicar ahora",
    callButton: "Llamar ahora",
    contact: "Contacto",
    trustTitle: "Por qué trabajar con Kari",
    trust1Title: "Prestamista preferida",
    trust1Text: "Orientación de confianza de una profesional hipotecaria dedicada.",
    trust2Title: "En todo el país",
    trust2Text: "Con licencia para ayudar a clientes en los 50 estados.",
    trust3Title: "Flexibilidad de préstamos",
    trust3Text: "Programas tradicionales, Non-QM y DSCR adaptados a la vida real.",
    aboutTitle: "Sobre Kari",
    aboutP1Before: "Me llamo Karithlyn Pastrana — puede llamarme ",
    aboutP1After:
      ". Me enfoco en respuestas claras, comunicación constante y préstamos que se ajustan a cómo usted gana y compra.",
    aboutP2:
      "Ya sea que compre, refinancie o invierta, estoy aquí para simplificar el proceso y ayudarle a sentirse seguro desde la solicitud hasta el cierre.",
    loanProgramsTitle: "Tipos de préstamos",
    loanProgramsIntro: "Opciones para compradores, historiales de ingresos únicos e inversionistas.",
    bestForLabel: "Ideal para",
    program1Title: "Préstamos tradicionales",
    program1Desc: "Convencionales y respaldados por el gobierno con condiciones competitivas.",
    program1BestFor: "Empleados con W-2, buen crédito y documentación estándar.",
    program2Title: "Préstamos Non-QM",
    program2Desc: "Subscripción flexible cuando las declaraciones de impuestos no cuentan toda la historia.",
    program2BestFor: "Trabajadores por cuenta propia e ingresos no tradicionales.",
    program3Title: "DSCR / préstamos para inversionistas",
    program3Desc: "Se consideran ingresos por alquiler y flujo de la propiedad para compras de inversión.",
    program3BestFor: "Inversionistas inmobiliarios que construyen o amplían su cartera.",
    howItWorksTitle: "Cómo funciona",
    step1Title: "Solicite en línea",
    step1Text: "Inicie su solicitud de forma segura: solo toma unos minutos.",
    step2Title: "Obtenga preaprobación",
    step2Text: "Conozca su capacidad de compra y opciones de préstamo con un plan claro.",
    step3Title: "Cierre con confianza",
    step3Text: "Manténgase informado durante la evaluación hasta la mesa de cierre.",
    ctaTitle: "¿Listo para empezar?",
    ctaSubBefore: "Dé el siguiente paso hacia la preaprobación — o comuníquese con Kari al ",
    ctaSubOr: " o al correo ",
    ctaSubAfter: ".",
    preferredLender: "Prestamista preferida",
    photoAlt: "Kari Pastrana, oficial de préstamos",
    nmlsPhoto: "NMLS# 2745146",
  },
};

export default function Home() {
  const applicationUrl = process.env.NEXT_PUBLIC_EXTERNAL_APPLICATION_URL ?? "#";

  const [language, setLanguage] = useState<Lang>("en");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "en" || stored === "es") setLanguage(stored);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {
      /* ignore */
    }
    document.documentElement.lang = language;
  }, [language, hydrated]);

  const toggleLanguage = useCallback(() => {
    setLanguage((prev) => (prev === "en" ? "es" : "en"));
  }, []);

  const t = translations[language];

  return (
    <div className={styles.fullBleed}>
      <LandingStickyHeader
        applicationUrl={applicationUrl}
        applyLabel={t.applyButton}
        preferredLenderSub={t.preferredLender}
        langToggleLabel={language === "en" ? "Español" : "English"}
        onToggleLanguage={toggleLanguage}
      />
      <main className={styles.page}>
        {/* A. Hero */}
        <section className={styles.hero} aria-label="Introduction">
          <div className={styles.heroInner}>
            <div className={styles.heroCopy}>
              <p className={styles.heroBrand}>{t.heroBrand}</p>
              <h1 className={styles.heroHeadline}>{t.heroTitle}</h1>
              <p className={styles.heroSubhead}>{t.heroSubtitle}</p>
              <div className={styles.ctaRow}>
                <a href={applicationUrl} className={styles.btnPrimary}>
                  {t.applyButton}
                </a>
                <a href={PHONE_TEL} className={styles.btnSecondary}>
                  {t.callButton}
                </a>
                <a href={`mailto:${EMAIL}`} className={styles.btnGhost}>
                  {t.contact}
                </a>
              </div>
            </div>
            <div className={styles.photoCol}>
              <img src="/kari.jpg" alt={t.photoAlt} className={styles.photo} />
              <p className={styles.nmlsPhoto}>{t.nmlsPhoto}</p>
            </div>
          </div>
        </section>

        {/* B. Trust / authority */}
        <section className={styles.section} aria-labelledby="trust-heading">
          <h2 id="trust-heading" className={styles.sectionTitle}>
            {t.trustTitle}
          </h2>
          <div className={styles.trustGrid}>
            <div className={styles.trustCard}>
              <span className={styles.trustIcon} aria-hidden="true">
                ✓
              </span>
              <h3 className={styles.trustCardTitle}>{t.trust1Title}</h3>
              <p className={styles.trustCardText}>{t.trust1Text}</p>
            </div>
            <div className={styles.trustCard}>
              <span className={styles.trustIcon} aria-hidden="true">
                50
              </span>
              <h3 className={styles.trustCardTitle}>{t.trust2Title}</h3>
              <p className={styles.trustCardText}>{t.trust2Text}</p>
            </div>
            <div className={styles.trustCard}>
              <span className={styles.trustIcon} aria-hidden="true">
                ◆
              </span>
              <h3 className={styles.trustCardTitle}>{t.trust3Title}</h3>
              <p className={styles.trustCardText}>{t.trust3Text}</p>
            </div>
          </div>
        </section>

        {/* C. About */}
        <section className={styles.section} aria-labelledby="about-heading">
          <h2 id="about-heading" className={styles.sectionTitle}>
            {t.aboutTitle}
          </h2>
          <div className={styles.aboutStack}>
            <p className={styles.bodyLead}>
              {t.aboutP1Before}
              <strong>Kari</strong>
              {t.aboutP1After}
            </p>
            <p className={styles.bodyText}>{t.aboutP2}</p>
          </div>
        </section>

        {/* D. Loan programs */}
        <section className={styles.section} aria-labelledby="programs-heading">
          <h2 id="programs-heading" className={styles.sectionTitle}>
            {t.loanProgramsTitle}
          </h2>
          <p className={styles.sectionIntro}>{t.loanProgramsIntro}</p>
          <div className={styles.programGrid}>
            <article className={styles.programCard}>
              <h3 className={styles.programTitle}>{t.program1Title}</h3>
              <p className={styles.programDesc}>{t.program1Desc}</p>
              <p className={styles.programFor}>
                <span className={styles.programForLabel}>{t.bestForLabel}</span> {t.program1BestFor}
              </p>
            </article>
            <article className={styles.programCard}>
              <h3 className={styles.programTitle}>{t.program2Title}</h3>
              <p className={styles.programDesc}>{t.program2Desc}</p>
              <p className={styles.programFor}>
                <span className={styles.programForLabel}>{t.bestForLabel}</span> {t.program2BestFor}
              </p>
            </article>
            <article className={styles.programCard}>
              <h3 className={styles.programTitle}>{t.program3Title}</h3>
              <p className={styles.programDesc}>{t.program3Desc}</p>
              <p className={styles.programFor}>
                <span className={styles.programForLabel}>{t.bestForLabel}</span> {t.program3BestFor}
              </p>
            </article>
          </div>
        </section>

        {/* E. How it works */}
        <section className={styles.section} aria-labelledby="steps-heading">
          <h2 id="steps-heading" className={styles.sectionTitle}>
            {t.howItWorksTitle}
          </h2>
          <ol className={styles.steps}>
            <li className={styles.step}>
              <span className={styles.stepNum}>1</span>
              <div>
                <h3 className={styles.stepTitle}>{t.step1Title}</h3>
                <p className={styles.stepText}>{t.step1Text}</p>
              </div>
            </li>
            <li className={styles.step}>
              <span className={styles.stepNum}>2</span>
              <div>
                <h3 className={styles.stepTitle}>{t.step2Title}</h3>
                <p className={styles.stepText}>{t.step2Text}</p>
              </div>
            </li>
            <li className={styles.step}>
              <span className={styles.stepNum}>3</span>
              <div>
                <h3 className={styles.stepTitle}>{t.step3Title}</h3>
                <p className={styles.stepText}>{t.step3Text}</p>
              </div>
            </li>
          </ol>
        </section>

        {/* F. Repeat CTA */}
        <section className={styles.ctaBand} aria-labelledby="cta-heading">
          <div className={styles.ctaBandInner}>
            <h2 id="cta-heading" className={styles.ctaBandTitle}>
              {t.ctaTitle}
            </h2>
            <p className={styles.ctaBandSub}>
              {t.ctaSubBefore}
              <a href={PHONE_TEL} className={styles.inlineLink}>
                {PHONE_DISPLAY}
              </a>
              {t.ctaSubOr}
              <a href={`mailto:${EMAIL}`} className={styles.inlineLink}>
                {EMAIL}
              </a>
              {t.ctaSubAfter}
            </p>
            <a href={applicationUrl} className={styles.btnPrimaryLg}>
              {t.applyButton}
            </a>
          </div>
        </section>

        {/* Reviews section intentionally removed. Add real client testimonials here in the future. */}

        {/* G. Footer */}
        <footer role="contentinfo" className={styles.footer}>
          <div className={styles.footerInner}>
            <img
              src="/novus-logo.png"
              alt=""
              className={styles.footerLogo}
              width={200}
              height={36}
              aria-hidden={true}
            />
            <p className={styles.footerCompany}>Novus Home Mortgage</p>
            <p className={styles.footerNmls}>NMLS# 423065</p>
            <p className={styles.footerOfficer}>Kari Pastrana · NMLS# 2745146</p>
            <address className={styles.footerAddress}>
              20225 Water Tower Blvd, Suite 400
              <br />
              Brookfield, WI 53045
            </address>
          </div>
        </footer>
      </main>
    </div>
  );
}
