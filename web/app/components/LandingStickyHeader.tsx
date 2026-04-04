import styles from "../landing.module.css";

const LOGO_SRC = "/novus-logo.png";

type Props = {
  applicationUrl: string;
};

export function LandingStickyHeader({ applicationUrl }: Props) {
  return (
    <header className={styles.stickyHeader} role="banner">
      <div className={styles.stickyInner}>
        <div className={styles.stickyLeft}>
          <img
            src={LOGO_SRC}
            alt="Novus Home Mortgage"
            className={styles.stickyLogo}
            width={220}
            height={40}
          />
          <div className={styles.stickyNameBlock}>
            <span className={styles.stickyOfficerName}>Kari Pastrana</span>
            <span className={styles.stickyOfficerSub}>Preferred Lender</span>
          </div>
        </div>
        <a href={applicationUrl} className={styles.stickyApply}>
          Apply Now
        </a>
      </div>
    </header>
  );
}
