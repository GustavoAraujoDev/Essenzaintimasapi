
const nodemailer = require("nodemailer");

class EmailService {
  constructor() {
    this.transporter = null;
  }

  criarTransporter() {
    const obrigatorias = [
      "SMTP_HOST",
      "SMTP_USER",
      "SMTP_PASS",
      "EMAIL_FROM"
    ];

    const ausentes = obrigatorias.filter(
      (nome) => !process.env[nome]?.trim()
    );

    if (ausentes.length > 0) {
      console.error(
        "[EMAIL_CONFIG] Variáveis ausentes:",
        ausentes
      );

      throw new Error(
        "Serviço de e-mail não configurado."
      );
    }

    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 20000
      });
    }

    return this.transporter;
  }

  async enviarConfirmacaoEmail(destinatario, link) {
    if (
      typeof destinatario !== "string" ||
      !destinatario.trim()
    ) {
      throw new Error("Destinatário do e-mail inválido.");
    }

    if (typeof link !== "string" || !link.trim()) {
      throw new Error("Link de confirmação inválido.");
    }

    let url;

    try {
      url = new URL(link);
    } catch {
      throw new Error("Link de confirmação inválido.");
    }

    if (
      url.protocol !== "https:" &&
      !(url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname))
    ) {
      throw new Error(
        "O link de confirmação deve usar HTTPS."
      );
    }

    const transporter = this.criarTransporter();

    try {
      const resultado = await transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to: destinatario.trim(),
        subject: "Confirme a alteração do seu e-mail",

        text: [
          "Recebemos uma solicitação para alterar o e-mail da sua conta.",
          "",
          `Confirme a alteração acessando: ${url.href}`,
          "",
          "Se você não solicitou essa mudança, ignore esta mensagem."
        ].join("\n"),

        html: `
          <!DOCTYPE html>
          <html lang="pt-BR">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport"
                    content="width=device-width, initial-scale=1.0">
              <title>Confirme seu novo e-mail</title>
            </head>
            <body style="margin:0;padding:24px;background:#F8F5F2;
                         font-family:Arial,sans-serif;color:#26211E">
              <div style="max-width:560px;margin:0 auto;padding:32px;
                          background:#FFFFFF;border-radius:12px">
                <h2 style="margin-top:0;color:#26211E">
                  Confirme seu novo e-mail
                </h2>

                <p>
                  Recebemos uma solicitação para alterar
                  o e-mail da sua conta.
                </p>

                <p style="margin:28px 0">
                  <a href="${url.href}"
                     style="display:inline-block;padding:12px 20px;
                            background:#26211E;color:#FFFFFF;
                            text-decoration:none;border-radius:6px">
                    Confirmar e-mail
                  </a>
                </p>

                <p style="font-size:13px;color:#666666">
                  Se você não solicitou essa mudança,
                  ignore esta mensagem.
                </p>
              </div>
            </body>
          </html>
        `
      });

      console.log("[EMAIL] Confirmação enviada.", {
        messageId: resultado.messageId,
        destinatario: destinatario.trim()
      });

      return resultado;
    } catch (error) {
      console.error("[EMAIL_SEND_ERROR]", {
        message: error.message,
        code: error.code,
        responseCode: error.responseCode
      });

      throw new Error(
        "Não foi possível enviar o e-mail de confirmação."
      );
    }
  }
}

module.exports = new EmailService();
