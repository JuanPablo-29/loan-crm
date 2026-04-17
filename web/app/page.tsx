import styles from "./under-construction.module.css";

/**
 * Temporary public homepage — under construction.
 * Legacy marketing landing preserved in git + `web/_archive/legacy-public-landing/README.md`.
 */
export default function Home() {
  return (
    <div className={styles.wrapper}>
      <header className={styles.topBar}>Kari Pastrana</header>
      <main className={styles.main}>
        <div className={styles.ambient} aria-hidden>
          <div className={styles.orb} />
        </div>
        <div className={styles.card}>
          <div className={styles.divider} />
          <h1 className={styles.headline}>Website Under Construction</h1>
          <p className={styles.subhead}>
            We&apos;re preparing a new experience and will be back soon.
          </p>
          <p className={styles.thanks}>Thank you for your patience.</p>
        </div>
      </main>
    </div>
  );
}
