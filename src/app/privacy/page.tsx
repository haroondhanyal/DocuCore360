import Link from "next/link";
export const metadata = { title: "Our privacy approach" };
export default function Page() {
  return (
    <>
      <div className="page-intro">
        <div>
          <h1>Our privacy approach</h1>
          <p>
            Your files. Your control. Understand what stays on your device and what you choose to
            save.
          </p>
        </div>
      </div>
      <div className="panel prose max-w-3xl">
        <h2>Processing on your device</h2>
        <p>
          Current PDF, image, OCR and conversion tools process documents in your browser. Signing in
          does not automatically upload their inputs or results. Downloads create a separate output;
          your original file stays unchanged.
        </p>
        <h2>Local drafts and preferences</h2>
        <p>
          Choosing a local editor draft saves it in this browser profile until you delete it or
          clear browser storage. Appearance preferences are also remembered locally. Local drafts
          are not an offsite backup and are not automatically available on other devices.
        </p>
        <h2>What is stored on the server?</h2>
        <p>
          Save to My Files uploads the selected document. Saving an account draft uploads its
          document and editable state. Profile photo upload stores a private, resized image. Account
          details, saved appearance preferences, favourites and processing-history metadata are also
          stored by this deployment. Processing history can include file names and result sizes; it
          is separate from saving a document.
        </p>
        <h2>Private access and account email</h2>
        <p>
          Saved files, versions, drafts and profile photos require an authorized session. Files are
          stored outside the public web directory. Password-reset and verification messages use the
          email service configured by the deployment owner.
        </p>
        <h2>Removal and retention</h2>
        <p>
          You can delete saved files and drafts, remove your profile photo, and delete your account
          from Account security. Account deletion removes its saved assets and sessions. Deployment
          backups and operational logs are managed separately by the deployment owner; backup
          retention depends on that deployment. Temporary server assets use the configured cleanup
          schedule.
        </p>
        <h2>Your next step</h2>
        <p>
          <Link className="underline" href="/records">
            View your records
          </Link>{" "}
          or{" "}
          <Link className="underline" href="/profile/settings">
            manage account security
          </Link>
          . For tool instructions and troubleshooting, visit{" "}
          <Link className="underline" href="/help">
            Help &amp; resources
          </Link>
          .
        </p>
      </div>
    </>
  );
}
