import styles from "./landing.module.css";

export default function Home() {
  const applicationUrl = process.env.NEXT_PUBLIC_EXTERNAL_APPLICATION_URL ?? "#";

  return (
    <div className={styles.fullBleed}>
    <main className={styles.page}>
      <section className={styles.hero} aria-label="Introduction">
        <div className={styles.heroInner}>
          <div>
            <p className={styles.eyebrow}>KARIPASTRANA.COM</p>
            <h1 className={styles.title}>Kari Pastrana</h1>
            <p className={styles.subtitle}>Preferred Lender · Mortgage professional</p>
            <p className={styles.tagline}>
              Helping you move from browsing homes to a confident pre-approval—with clear guidance, responsive
              communication, and lending options tailored to your situation.
            </p>
            <div className={styles.ctaRow}>
              <a href={applicationUrl} className={styles.btnPrimary}>
                Apply
              </a>
              <a href="mailto:kari.pastrana@novushomemortgage.com" className={styles.btnSecondary}>
                Contact Kari
              </a>
            </div>
          </div>
          <div className={styles.photoCol}>
            <img src="/kari.jpg" alt="Kari Pastrana" className={styles.photo} />
            <p className={styles.nmlsPhoto}>NMLS# 2745146</p>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="about-heading">
        <h2 id="about-heading" className={styles.sectionTitle}>
          About Kari
        </h2>
        <p className={styles.bodyText}>
          My name is Karithlyn Pastrana, but you can call me Kari. I am a dedicated mortgage professional committed
          to helping clients navigate financing with confidence and clarity.
          <br />
          <br />
          I specialize in a wide range of loan programs, including traditional loans, Non-QM options, and DSCR
          loans, allowing me to serve clients with diverse financial situations. Whether you are a first-time
          buyer, investor, or self-employed borrower, I work to find tailored solutions that fit your needs. I
          am also licensed to assist clients in all 50 states, providing flexibility no matter where you are
          purchasing or refinancing.
          <br />
          <br />
          My approach is rooted in putting clients first, maintaining clear communication, and guiding you through
          every step of the lending process. From pre-approval to closing, my goal is to make the experience
          smooth, efficient, and stress-free.
          <br />
          <br />
          I look forward to helping you achieve your home financing goals and being a trusted resource along the
          way.
        </p>
      </section>

      <section className={styles.section} aria-labelledby="services-heading">
        <h2 id="services-heading" className={styles.sectionTitle}>
          Services &amp; lending support
        </h2>
        <ul className={styles.list}>
          <li>Pre-approval consultations</li>
          <li>Purchase loan guidance</li>
          <li>Rate and payment scenario planning</li>
          <li>Fast communication through every step</li>
        </ul>
      </section>

      <section className={styles.contactSection} aria-labelledby="contact-heading">
        <h2 id="contact-heading" className={styles.contactTitle}>
          Contact
        </h2>
        <p className={styles.bodyText} style={{ marginBottom: "0.5rem" }}>
          Reach out by email to get started or ask a question.
        </p>
        <a href="mailto:kari.pastrana@novushomemortgage.com" className={styles.contactLink}>
          kari.pastrana@novushomemortgage.com
        </a>
      </section>

      <footer role="contentinfo" className={styles.footer}>
        <div className={styles.footerInner}>
          <p className={styles.footerCompany}>Novus Home Mortgage</p>
          <p className={styles.footerNmls}>NMLS# 423065</p>
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
