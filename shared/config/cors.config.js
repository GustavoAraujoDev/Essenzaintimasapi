const API_URL = "https://prafoodapi.onrender.com";
const corsWhiteList = {
  development: [
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "https://prafood.vercel.app",
    "https://prafoodparceiros.vercel.app",
    "https://essenzaintimasmobile.vercel.app"
  ],
  staging: [
    "https://staging.app.com",
    "https://prafood.vercel.app",
    "https://prafoodparceiros.vercel.app",
    "https://pratinho-pra-tudo.vercel.app",
    "https://pratinhopratudoparceiros.vercel.app",
    "https://www.pratinhopratudo.com.br",
    "https://essenzaintimasmobile.vercel.app"
  ],
  production: [
    "https://apicardapiovanburger.onrender.com",
    "https://meuapp.com",
    "https://prafood.vercel.app",
    API_URL,
    "https://prafoodparceiros.vercel.app",
    "https://pratinho-pra-tudo.vercel.app",
    "https://pratinhopratudoparceiros.vercel.app",
    "https://www.pratinhopratudo.com.br",
    "https://essenzaintimasmobile.vercel.app"
  ],
};

module.exports = corsWhiteList;
