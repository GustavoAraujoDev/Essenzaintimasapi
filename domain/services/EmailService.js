
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

class EmailService {
  async enviarConfirmacaoEmail(destinatario, link) {
    if (
      !process.env.SMTP_HOST ||
      !process.env.SMTP_USER ||
      !process.env.SMTP_PASS ||
      !process.env.EMAIL_FROM
    ) {
      throw new Error("Serviço de e-mail não configurado.");
    }

    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: destinatario,
      subject: "Confirme a alteração do seu e-mail",
      text: [
        "Recebemos uma solicitação para alterar o e-mail da sua conta.",
        "",
        `Confirme a alteração acessando: ${link}`,
        "",
        "Se você não solicitou essa mudança, ignore esta mensagem."
      ].join("\n"),
      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto">
          <h2>Confirme seu novo e-mail</h2>
          <p>Recebemos uma solicitação para alterar o e-mail da sua conta.</p>
          <p>
            <a href="${link}"
               style="display:inline-block;padding:12px 18px;background:#26211E;color:#fff;text-decoration:none;border-radius:6px">
              Confirmar e-mail
            </a>
          </p>
          <p>Se você não solicitou essa mudança, ignore esta mensagem.</p>
        </div>
      `
    });
  }
}

module.exports = new EmailService();
