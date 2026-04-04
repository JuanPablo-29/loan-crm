import { LandingStickyHeader } from "./components/LandingStickyHeader";
import styles from "./landing.module.css";

const PHONE_DISPLAY = "(850) 420-7731";
const PHONE_TEL = "tel:+18504207731";
const EMAIL = "kari.pastrana@novushomemortgage.com";

export default function Home() {
  const applicationUrl = process.env.NEXT_PUBLIC_EXTERNAL_APPLICATION_URL ?? "#";

  return (
    <div className={styles.fullBleed}>
      <LandingStickyHeader applicationUrl={applicationUrl} />
      <main className={styles.page}>
        {/* A. Hero */}
        <section className={styles.hero} aria-label="Introduction">
          <div className={styles.heroInner}>
            <div className={styles.heroCopy}>
              <p className={styles.heroBrand}>Kari Pastrana · Preferred Lender</p>
              <h1 className={styles.heroHeadline}>Simple, Stress-Free Home Financing</h1>
              <p className={styles.heroSubhead}>
                Helping you get approved with the right loan — traditional, Non-QM, and DSCR options available
                nationwide.
              </p>
              <div className={styles.ctaRow}>
                <a href={applicationUrl} className={styles.btnPrimary}>
                  Apply Now
                </a>
                <a href={PHONE_TEL} className={styles.btnSecondary}>
                  Call Now
                </a>
                <a href={`mailto:${EMAIL}`} className={styles.btnGhost}>
                  Contact
                </a>
              </div>
            </div>
            <div className={styles.photoCol}>
              <img src="/kari.jpg" alt="Kari Pastrana, loan officer" className={styles.photo} />
              <p className={styles.nmlsPhoto}>NMLS# 2745146</p>
            </div>
          </div>
        </section>

        {/* B. Trust / authority */}
        <section className={styles.section} aria-labelledby="trust-heading">
          <h2 id="trust-heading" className={styles.sectionTitle}>
            Why work with Kari
          </h2>
          <div className={styles.trustGrid}>
            <div className={styles.trustCard}>
              <span className={styles.trustIcon} aria-hidden="true">
                ✓
              </span>
              <h3 className={styles.trustCardTitle}>Preferred Lender</h3>
              <p className={styles.trustCardText}>Trusted guidance from a dedicated mortgage professional.</p>
            </div>
            <div className={styles.trustCard}>
              <span className={styles.trustIcon} aria-hidden="true">
                50
              </span>
              <h3 className={styles.trustCardTitle}>Nationwide</h3>
              <p className={styles.trustCardText}>Licensed to help clients in all 50 states.</p>
            </div>
            <div className={styles.trustCard}>
              <span className={styles.trustIcon} aria-hidden="true">
                ◆
              </span>
              <h3 className={styles.trustCardTitle}>Loan flexibility</h3>
              <p className={styles.trustCardText}>Traditional, Non-QM, and DSCR programs to fit real-life situations.</p>
            </div>
          </div>
        </section>

        {/* C. About */}
        <section className={styles.section} aria-labelledby="about-heading">
          <h2 id="about-heading" className={styles.sectionTitle}>
            About Kari
          </h2>
          <div className={styles.aboutStack}>
            <p className={styles.bodyLead}>
              My name is Karithlyn Pastrana — you can call me <strong>Kari</strong>. I focus on clear answers, steady
              communication, and loans that match how you actually earn and buy.
            </p>
            <p className={styles.bodyText}>
              Whether you&apos;re purchasing, refinancing, or investing, I&apos;m here to simplify the process and help
              you feel confident from application to closing.
            </p>
          </div>
        </section>

        {/* D. Loan programs */}
        <section className={styles.section} aria-labelledby="programs-heading">
          <h2 id="programs-heading" className={styles.sectionTitle}>
            Loan programs
          </h2>
          <p className={styles.sectionIntro}>Options designed for everyday buyers, unique income stories, and investors.</p>
          <div className={styles.programGrid}>
            <article className={styles.programCard}>
              <h3 className={styles.programTitle}>Traditional loans</h3>
              <p className={styles.programDesc}>Conventional and government-backed paths with competitive terms.</p>
              <p className={styles.programFor}>
                <span className={styles.programForLabel}>Best for</span> W-2 employees, strong credit, standard documentation.
              </p>
            </article>
            <article className={styles.programCard}>
              <h3 className={styles.programTitle}>Non-QM loans</h3>
              <p className={styles.programDesc}>Flexible underwriting when tax returns don&apos;t tell the whole story.</p>
              <p className={styles.programFor}>
                <span className={styles.programForLabel}>Best for</span> Self-employed borrowers and non-traditional income.
              </p>
            </article>
            <article className={styles.programCard}>
              <h3 className={styles.programTitle}>DSCR / investor loans</h3>
              <p className={styles.programDesc}>Rental income and property cash flow considered for investment purchases.</p>
              <p className={styles.programFor}>
                <span className={styles.programForLabel}>Best for</span> Real estate investors building or scaling a portfolio.
              </p>
            </article>
          </div>
        </section>

        {/* E. How it works */}
        <section className={styles.section} aria-labelledby="steps-heading">
          <h2 id="steps-heading" className={styles.sectionTitle}>
            How it works
          </h2>
          <ol className={styles.steps}>
            <li className={styles.step}>
              <span className={styles.stepNum}>1</span>
              <div>
                <h3 className={styles.stepTitle}>Apply online</h3>
                <p className={styles.stepText}>Start your application securely — it only takes a few minutes.</p>
              </div>
            </li>
            <li className={styles.step}>
              <span className={styles.stepNum}>2</span>
              <div>
                <h3 className={styles.stepTitle}>Get pre-approved</h3>
                <p className={styles.stepText}>Know your buying power and loan options with a clear plan.</p>
              </div>
            </li>
            <li className={styles.step}>
              <span className={styles.stepNum}>3</span>
              <div>
                <h3 className={styles.stepTitle}>Close with confidence</h3>
                <p className={styles.stepText}>Stay informed through underwriting to the closing table.</p>
              </div>
            </li>
          </ol>
        </section>

        {/* F. Repeat CTA */}
        <section className={styles.ctaBand} aria-labelledby="cta-heading">
          <div className={styles.ctaBandInner}>
            <h2 id="cta-heading" className={styles.ctaBandTitle}>
              Ready to get started?
            </h2>
            <p className={styles.ctaBandSub}>
              Take the next step toward pre-approval — or reach Kari at{" "}
              <a href={PHONE_TEL} className={styles.inlineLink}>
                {PHONE_DISPLAY}
              </a>{" "}
              or{" "}
              <a href={`mailto:${EMAIL}`} className={styles.inlineLink}>
                {EMAIL}
              </a>
              .
            </p>
            <a href={applicationUrl} className={styles.btnPrimaryLg}>
              Apply Now
            </a>
          </div>
        </section>

        {/* Reviews */}
        <section className={styles.reviewsSection} aria-labelledby="reviews-heading">
          <h2 id="reviews-heading" className={styles.reviewsTitle}>
            What clients are saying
          </h2>
          <div className={styles.reviewsGrid}>
            <blockquote className={styles.reviewCard}>
              <p className={styles.reviewStars} aria-label="5 out of 5 stars">
                ★★★★★
              </p>
              <p className={styles.reviewQuote}>
                &ldquo;Kari made the entire process smooth and stress-free. Highly recommend!&rdquo;
              </p>
              <footer className={styles.reviewAuthor}>— Sarah M.</footer>
            </blockquote>
            <blockquote className={styles.reviewCard}>
              <p className={styles.reviewStars} aria-label="5 out of 5 stars">
                ★★★★★
              </p>
              <p className={styles.reviewQuote}>
                &ldquo;Very knowledgeable and responsive. Helped me secure the right loan quickly.&rdquo;
              </p>
              <footer className={styles.reviewAuthor}>— James T.</footer>
            </blockquote>
            <blockquote className={styles.reviewCard}>
              <p className={styles.reviewStars} aria-label="5 out of 5 stars">
                ★★★★★
              </p>
              <p className={styles.reviewQuote}>
                &ldquo;Excellent communication and guidance from start to finish.&rdquo;
              </p>
              <footer className={styles.reviewAuthor}>— Maria L.</footer>
            </blockquote>
          </div>
        </section>

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
