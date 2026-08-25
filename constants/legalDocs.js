// Este arquivo armazena as versões oficiais.
// Se você mudar o texto, crie uma nova chave (ex: v1.1, v2.0)
const legalVersions = {
  "v1.2024-05": {
    termos: {
      title: "Termos de Uso e Fluxo do Pedido",
      content: `
        <h4 class="font-bold text-gray-800 mt-2">1. Objeto e Funcionamento do Sistema</h4>
        <p class="text-gray-600 text-xs">O PraFood atua como plataforma de intermediação tecnológica. Ao finalizar uma compra, seu pedido é primeiramente registrado de forma segura em nosso banco de dados e, em seguida, direcionado ao canal de atendimento (WhatsApp) do estabelecimento para validação.</p>
        
        <h4 class="font-bold text-gray-800 mt-3">2. Notificações e Atualizações de Status</h4>
        <p class="text-gray-600 text-xs">O usuário concorda em receber mensagens automáticas e notificações em seu WhatsApp informando sobre as atualizações do status do seu pedido (ex: "Em Preparo", "Saiu para Entrega", "Disponível para Retirada") disparadas pelo painel administrativo da empresa.</p>

        <h4 class="font-bold text-gray-800 mt-3">3. Responsabilidades</h4>
        <p class="text-gray-600 text-xs">O estabelecimento comercial é o único e exclusivo responsável pelo preparo, acondicionamento, qualidade, precificação e logística de entrega dos produtos. O usuário é inteiramente responsável por fornecer dados exatos de contato e endereço.</p>
        
        <h4 class="font-bold text-gray-800 mt-3">4. Política de Cancelamento (CDC)</h4>
        <p class="text-gray-600 text-xs">Em conformidade com o Código de Defesa do Consumidor, tratando-se de produtos perecíveis e de consumo imediato, o cancelamento ou alteração do pedido só poderá ser efetuado antes do início do preparo por parte da cozinha do estabelecimento.</p>
        
        <h4 class="font-bold text-gray-800 mt-3">5. Pagamentos e Taxas</h4>
        <p class="text-gray-600 text-xs">Todos os valores dos itens, bem como as taxas de entrega calculadas por bairro/região, são estipulados diretamente pelo restaurante. Eventuais divergências ou falhas de processamento devem ser comunicadas imediatamente ao canal de suporte do estabelecimento.</p>
      `,
    },
    privacidade: {
      title: "Política de Privacidade e Proteção de Dados (LGPD)",
      content: `
        <div class="mb-2 p-2 bg-red-50 rounded-xl border border-red-100">
          <h4 class="font-black text-red-600 uppercase text-[10px] flex items-center gap-1">
            <i class="fas fa-shield-alt"></i> 100% Em Conformidade com a LGPD (Lei nº 13.709/18)
          </h4>
        </div>
        
        <p class="text-gray-600 text-xs mb-2"><strong>Dados Coletados estritamente necessários (Princípio da Minimização):</strong> Nome completo, número de telefone celular/WhatsApp e endereço completo de entrega.</p>
        
        <h4 class="font-bold text-gray-800 mt-3">1. Finalidade do Tratamento de Dados</h4>
        <p class="text-gray-600 text-xs">Seus dados pessoais são utilizados unicamente para as seguintes finalidades operacionais: Registrar o pedido de forma auditável no banco de dados, gerar a autenticação da compra, emitir as informações necessárias para a entrega física e permitir que o painel da empresa envie alertas de status do pedido para o seu WhatsApp.</p>
        
        <h4 class="font-bold text-gray-800 mt-3">2. Compartilhamento estrito para Operação</h4>
        <p class="text-gray-600 text-xs">Para que seu pedido seja atendido, seus dados de identificação e endereço são compartilhados apenas com a equipe interna do restaurante (gestão e cozinha) e com o agente logístico encarregado (entregador/motoboy). É expressamente vedada a venda, cessão ou compartilhamento desses dados com terceiros para fins de marketing.</p>
        
        <h4 class="font-bold text-gray-800 mt-3">3. Armazenamento e Histórico de Consentimento</h4>
        <p class="text-gray-600 text-xs">No momento do checkout, o sistema captura de forma digital o seu aceite, registrando a data, a hora e as especificações do dispositivo (User Agent), garantindo segurança jurídica para ambas as partes. Os dados permanecem salvos em ambiente seguro para fins de cumprimento de obrigação legal e histórico de pedidos.</p>

        <h4 class="font-bold text-gray-800 mt-3">4. Direitos do Titular dos Dados</h4>
        <p class="text-gray-600 text-xs">Você possui o direito de confirmar a existência do tratamento, acessar seus dados ou solicitar a exclusão definitiva de suas informações da nossa base de dados a qualquer momento, bastando formalizar a requisição junto ao suporte do estabelecimento.</p>
      `,
    },
  },
};

module.exports = legalVersions;
