export default function Home() {
  const applicationUrl = process.env.NEXT_PUBLIC_EXTERNAL_APPLICATION_URL ?? "#";

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "2.5rem 1.25rem 3rem" }}>
      <section
        className="card"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.5fr) minmax(240px, 1fr)",
          gap: "1.5rem",
          alignItems: "center",
        }}
      >
        <div>
          <p style={{ marginTop: 0, color: "var(--muted)", fontWeight: 600, letterSpacing: "0.04em" }}>
            KARIPASTRANA.COM
          </p>
          <h1 style={{ marginTop: 0, marginBottom: "0.4rem" }}>Kari Pastrana</h1>
          <p style={{ marginTop: 0, color: "var(--muted)", fontSize: "1.05rem" }}>Preferred Lender</p>
          <p style={{ lineHeight: 1.6 }}>
            Helping homebuyers move confidently from search to pre-approval with personalized lending guidance
            and responsive support.
          </p>
          <div style={{ display: "flex", gap: "0.7rem", flexWrap: "wrap", marginTop: "1rem" }}>
            <a href={applicationUrl} className="btn btn-primary" style={{ textDecoration: "none" }}>
              Apply
            </a>
            <a
              href="mailto:kari.pastrana@novushomemortgage.com"
              className="btn"
              style={{ textDecoration: "none" }}
            >
              Contact Kari
            </a>
          </div>
        </div>
        <div style={{ justifySelf: "center", width: "100%", maxWidth: 280 }}>
          <img
            src="/kari.jpg"
            alt="Kari Pastrana profile placeholder"
            style={{ width: "100%", borderRadius: 12, border: "1px solid var(--border)", display: "block" }}
          />
        </div>
      </section>

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2 style={{ marginTop: 0 }}>About</h2>
        <p style={{ marginBottom: 0, lineHeight: 1.65 }}>
          Greetings - it's a pleasure to meet you! My name is Kari Pastrana, but please call me Kari. I am a
          dedicated mortgage professional committed to helping clients navigate financing with confidence and
          clarity.
          <br />
          <br />
          I specialize in a wide range of loan programs, including traditional loans, Non-QM options, and DSR
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

      <section className="card" style={{ marginTop: "1rem" }}>
        <h2 style={{ marginTop: 0 }}>Services</h2>
        <ul style={{ margin: 0, paddingLeft: "1.2rem", lineHeight: 1.7 }}>
          <li>Pre-approval consultations</li>
          <li>Purchase loan guidance</li>
          <li>Rate and payment scenario planning</li>
          <li>Fast communication through every step</li>
        </ul>
      </section>

      <footer style={{ marginTop: "1.2rem", color: "var(--muted)", fontSize: "0.9rem", textAlign: "center" }}>
        Kari Pastrana • Preferred Lender • Novus Home Mortgage
      </footer>
    </main>
  );
}
