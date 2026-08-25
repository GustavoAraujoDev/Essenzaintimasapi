const API_URL = "https://essenzaintimasapi.onrender.com";
const corsWhiteList = {
  development: [
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "https://prafood.vercel.app",
    "https://prafoodparceiros.vercel.app",
    "https://essenzaintimasmobile.vercel.app",
    "https://essenzaintimas.vercel.app"
  ],
  staging: [
    "https://staging.app.com",
    "https://prafood.vercel.app",
    "https://prafoodparceiros.vercel.app",
    "https://pratinho-pra-tudo.vercel.app",
    "https://pratinhopratudoparceiros.vercel.app",
    "https://www.pratinhopratudo.com.br",
    "https://essenzaintimasmobile.vercel.app",
    "https://essenzaintimas.vercel.app"
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
    "https://essenzaintimasmobile.vercel.app",
    "https://essenzaintimas.vercel.app"
  ],
};

module.exports = corsWhiteList;
