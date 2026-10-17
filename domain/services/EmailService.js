
const nodemailer = require("nodemailer");

class EmailService {
  constructor() {
    this.transporter = null;
    this.transporterConfig = null;
  }

  criarTransporter() {
    const smtpUser = process.env.SMTP_USER?.trim();
    const smtpPass = process.env.SMTP_PASS?.trim();

    // Gmail SMTP: não exige domínio próprio.
    const smtpHost = process.env.SMTP_HOST?.trim()
      || "smtp.gmail.com";

    const smtpPort = Number(process.env.SMTP_PORT || 465);

    // O remetente deve ser a própria conta Gmail autenticada.
    const emailFrom = process.env.EMAIL_FROM?.trim()
      || smtpUser;

    if (!smtpUser || !smtpPass) {
      console.error("[EMAIL_CONFIG] Configure SMTP_USER e SMTP_PASS.");

      throw new Error("Serviço de e-mail não configurado.");
    }

    if (
      !Number.isInteger(smtpPort) ||
      smtpPort < 1 ||
      smtpPort > 65535
    ) {
      throw new Error("Porta SMTP inválida.");
    }

    // Impede que o remetente seja configurado com outra conta.
    const extrairEmail = (valor) => {
      const match = valor.match(/<([^<>]+)>/);
      return (match ? match[1] : valor).trim().toLowerCase();
    };

    if (extrairEmail(emailFrom) !== smtpUser.toLowerCase()) {
      throw new Error(
        "EMAIL_FROM deve usar a mesma conta Gmail de SMTP_USER."
      );
    }

    const secure =
      process.env.SMTP_SECURE !== undefined
        ? process.env.SMTP_SECURE === "true"
        : smtpPort === 465;

    const config = {
      host: smtpHost,
      port: smtpPort,
      secure,
      auth: {
        user: smtpUser,
        pass: smtpPass
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 25000
    };

    // Recria o transporter se as credenciais mudarem.
    const configKey = JSON.stringify({
      ...config,
      auth: {
        user: smtpUser,
        pass: undefined
      }
    });

    if (
      !this.transporter ||
      this.transporterConfig !== configKey
    ) {
      this.transporter = nodemailer.createTransport(config);
      this.transporterConfig = configKey;
    }

    return {
      transporter: this.transporter,
      emailFrom
    };
  }

  escaparHtml(valor) {
    return String(valor).replace(/[&<>"']/g, (caractere) => {
      const entidades = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      };

      return entidades[caractere];
    });
  }

  async enviarConfirmacaoEmail(destinatario, link) {
    if (
      typeof destinatario !== "string" ||
      !destinatario.trim()
    ) {
      throw new Error("Destinatário do e-mail inválido.");
    }

    const emailDestino = destinatario.trim();

    // Validação básica do destinatário.
    if (
      emailDestino.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailDestino)
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

    const urlLocalPermitida =
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(url.hostname);

    if (
      url.protocol !== "https:" &&
      !urlLocalPermitida
    ) {
      throw new Error(
        "O link de confirmação deve usar HTTPS."
      );
    }

    if (url.username || url.password) {
      throw new Error("Link de confirmação inválido.");
    }

    const { transporter, emailFrom } = this.criarTransporter();

    const linkSeguro = this.escaparHtml(url.href);

    try {
      const resultado = await transporter.sendMail({
        from: {
          name: "Essenza Íntimas",
          address: emailFrom.match(/<([^<>]+)>/)
            ? emailFrom.match(/<([^<>]+)>/)[1]
            : emailFrom
        },

        to: emailDestino,

        subject: "Confirme a alteração do seu e-mail",

        text: [
          "Olá!",
          "",
          "Recebemos uma solicitação para alterar o e-mail da sua conta Essenza Íntimas.",
          "",
          `Para confirmar a alteração, acesse: ${url.href}`,
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

                <p style="font-size:12px;letter-spacing:3px;
                          color:#9E7960;text-transform:uppercase">
                  ESSENZA ÍNTIMAS
                </p>

                <h2 style="margin-top:0;color:#26211E">
                  Confirme seu novo e-mail
                </h2>

                <p>
                  Recebemos uma solicitação para alterar o
                  e-mail associado à sua conta.
                </p>

                <p>
                  Para confirmar que você autorizou essa
                  alteração, clique no botão abaixo.
                </p>

                <p style="margin:28px 0">
                  <a href="${linkSeguro}"
                     style="display:inline-block;padding:14px 24px;
                            background:#26211E;color:#FFFFFF;
                            text-decoration:none;border-radius:6px">
                    Confirmar e-mail
                  </a>
                </p>

                <p style="font-size:13px;color:#666666">
                  Se o botão não funcionar, copie o link
                  de confirmação enviado nesta mensagem
                  e abra-o no navegador.
                </p>

                <p style="font-size:13px;color:#666666">
                  Se você não solicitou essa mudança,
                  ignore este e-mail.
                </p>

                <hr style="border:0;border-top:1px solid #E8DED5;
                           margin:28px 0">

                <p style="font-size:12px;color:#888888">
                  Essenza Íntimas — Mensagem automática.
                </p>

              </div>
            </body>
          </html>
        `
      });

      console.log("[EMAIL] Confirmação enviada.", {
        messageId: resultado.messageId,
        destinatario: emailDestino
      });

      return resultado;
    } catch (error) {
      // Não registrar senha, token ou link de confirmação.
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

  async verificarConexao() {
    const { transporter } = this.criarTransporter();

    try {
      await transporter.verify();

      console.log("[EMAIL] Conexão SMTP verificada.");
      return true;
    } catch (error) {
      console.error("[EMAIL_VERIFY_ERROR]", {
        message: error.message,
        code: error.code
      });

      throw new Error(
        "Não foi possível conectar ao servidor de e-mail."
      );
    }
  }
}

module.exports = new EmailService();
