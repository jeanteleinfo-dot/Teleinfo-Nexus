import { GoogleGenAI } from "@google/genai";
import { Project, DetailedProject } from "../types";

const getAI = () => {
  // 1. Try manual key from localStorage (for deployed apps)
  const manualKey = typeof window !== 'undefined' ? localStorage.getItem('NEXUS_GEMINI_API_KEY') : null;
  
  // 2. Try platform keys
  // process.env.API_KEY is injected by the platform key selection dialog
  // process.env.GEMINI_API_KEY is the standard secret name
  const apiKey = manualKey 
    || (typeof process !== 'undefined' && process.env ? (process.env.GEMINI_API_KEY || process.env.API_KEY) : null) 
    || ((import.meta as any).env ? (import.meta as any).env.VITE_GEMINI_API_KEY : null)
    || '';

  if (!apiKey) {
    console.warn("Gemini API Key is missing. AI features will be disabled.");
    return null;
  }
  
  // Always create a new instance to ensure we use the most up-to-date key from the dialog
  return new GoogleGenAI({ apiKey });
};

export const generateExecutiveSummary = async (contextData: string): Promise<string> => {
  const ai = getAI();
  if (!ai) return "Erro: API Key não configurada.";

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Você é um assistente executivo sênior de uma plataforma de TI chamada Teleinfo Nexus.
      
      Analise os seguintes dados brutos do sistema e forneça um resumo executivo de 1 parágrafo (max 50 palavras) em Português do Brasil.
      Foque em anomalias ou sucessos. Use formatação Markdown (negrito) para destaques.

      Dados:
      ${contextData}`,
      config: {
        temperature: 0.7,
      }
    });
    return response.text || "Não foi possível gerar o resumo.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Erro ao conectar com a IA.";
  }
};

export const generateProjectRiskAnalysis = async (project: Project): Promise<string> => {
  const ai = getAI();
  if (!ai) return "Erro: API Key não configurada.";

  try {
      const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `Você é um Gerente de Projetos Sênior da Teleinfo.
          Analise o seguinte projeto (linha de CSV) e identifique riscos potenciais, sugestões de ação e um breve status.
          Seja direto e profissional.
          
          Dados do Projeto:
          Cliente: ${project.CLIENTE}
          Tipo: ${project['TIPO DE PROJETO']}
          Produto: ${project['TIPO DE PRODUTO']}
          BU: ${project.BUs}
          Status Atual: ${project.STATUS}
          Progresso: ${project.perc}%
          
          Responda em Português do Brasil, formatado em HTML simples (sem tags html/body, apenas p, strong, ul, li).`,
          config: { temperature: 0.5 }
      });
      return response.text || "Análise indisponível.";
  } catch (error) {
      console.error(error);
      return "Erro ao gerar análise de risco.";
  }
};

export const generateDetailedProjectRiskAnalysis = async (project: DetailedProject): Promise<string> => {
  const ai = getAI();
  if (!ai) return "Erro: API Key não configurada.";

  try {
      const soldTotal = Object.values(project.soldHours).reduce((a, b) => a + b, 0);
      const usedTotal = Object.values(project.usedHours).reduce((a, b) => a + b, 0);
      const hoursRatio = soldTotal > 0 ? (usedTotal / soldTotal * 100).toFixed(1) : 0;

      const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `Atue como um Auditor de Projetos. Analise detalhadamente o projeto abaixo.
          
          Nome: ${project.name}
          Datas: ${project.start} até ${project.end}
          
          Etapas:
          ${project.steps.map(s => `- ${s.name}: ${s.perc}%`).join('\n')}
          
          Horas (Vendidas vs Utilizadas):
          - Infra: ${project.soldHours.infra} vs ${project.usedHours.infra}
          - Segurança: ${project.soldHours.sse} vs ${project.usedHours.sse}
          - TI: ${project.soldHours.ti} vs ${project.usedHours.ti}
          - Automação: ${project.soldHours.aut} vs ${project.usedHours.aut}
          
          Consumo Total de Horas: ${hoursRatio}% do orçamento.
          
          Forneça:
          1. Análise de Cronograma (está atrasado baseada na data de hoje: ${new Date().toLocaleDateString()}?)
          2. Análise Financeira/Horas (estourou orçamento em alguma BU?)
          3. Recomendações Críticas.
          
          Responda em Português do Brasil, formatado em HTML simples.`,
          config: { temperature: 0.5 }
      });
      return response.text || "Análise detalhada indisponível.";
  } catch (error) {
      console.error(error);
      return "Erro ao gerar análise detalhada.";
  }
};

export const generateSeniorPlanningAuditReport = async (project: DetailedProject): Promise<string> => {
  const ai = getAI();
  if (!ai) return "Erro: API Key não configurada. Por favor, configure a GEMINI_API_KEY nos segredos do projeto.";

  const calculateTimeProgress = (startStr: string, endStr: string) => {
    if (!startStr || !endStr) return 0;
    const start = new Date(startStr);
    const end = new Date(endStr);
    const today = new Date();
    if (today < start) return 0;
    if (today > end) return 100;
    const total = end.getTime() - start.getTime();
    const elapsed = today.getTime() - start.getTime();
    return Math.min(100, Math.round((elapsed / total) * 100));
  };

  const timeProgress = calculateTimeProgress(project.start, project.end);
  const steps = project.steps || [];
  const avgExec = steps.length > 0 ? steps.reduce((acc, s) => acc + s.perc, 0) / steps.length : 0;
  const sold = project.soldHours || { infra: 0, sse: 0, ti: 0 };
  const used = project.usedHours || { infra: 0, sse: 0, ti: 0 };

  const prompt = `Engenheiro AI Planejamento Sênior, Especialista em Custos e Auditor de Obras. Sua função é analisar os indicadores de um projeto de engenharia/tecnologia e emitir um relatório técnico gerencial. 

O foco é cruzar os dados de prazo (tempo decorrido), avanço físico da obra e o consumo de Horas-Homem (H/H) em três frentes: Infraestrutura, Segurança e Tecnologia.

**Fator Crítico de Auditoria:**
1. Analise todo o histórico do projeto contido nos dados abaixo.
2. Considere que, historicamente neste projeto, **80% dos atrasos e do consumo excedente de H/H são decorrentes de inclusões de trabalho fora do escopo original (Extra-Escopo)**.
3. **AVALIAÇÃO ESPECIAL:** Avalie se o volume de horas/obra contratada foi o ideal para a complexidade apresentada ou se houve subdimensionamento no planejamento inicial.

Dados do Projeto:
Projeto: ${project.name}
Centro de Custo / BU: ${project.costCenter || 'N/A'} / ${project.bu || 'N/A'}
Período: ${project.start || 'N/A'} a ${project.end || 'N/A'}
Tempo de Cronograma Decorrido: ${timeProgress}%
Avanço Físico Total (Fases): ${avgExec.toFixed(2)}%

Histórico de Fases:
${steps.length > 0 ? steps.map(s => `- ${s.name}: ${s.perc}% concluído`).join('\n') : 'Nenhuma fase cadastrada.'}

Gestão de H/H (Vendida vs. Utilizada):
Infraestrutura: Vendida = ${sold.infra} | Utilizada = ${used.infra}
Segurança (SEC): Vendida = ${sold.sse} | Utilizada = ${used.sse}
Tecnologia (TI): Vendida = ${sold.ti} | Utilizada = ${used.ti}

${project.productionData && project.productionData.length > 0 ? `Histórico de Produção (Meta vs Realizado):
${project.productionData.map(d => `- Data: ${d.date} | Meta: ${d.meta} | Realizado: ${d.realized}`).join('\n')}` : ''}

Observações e Pontos de Atenção (Informados pela Equipe - CAMPO CRÍTICO):
${project.observations || 'Nenhuma observação adicional informada.'}

Sua Tarefa:
Analise os dados fornecidos e gere um Relatório de Auditoria estruturado em formato Markdown, contendo obrigatoriamente as seguintes seções:

1. Parecer Técnico Geral
Avalie a saúde geral do projeto comparando o Tempo Decorrido com o Avanço Físico. Diga claramente se a obra está adiantada, atrasada ou dentro do cronograma, apontando o nível de criticidade.

2. Análise de Desempenho de H/H e Impacto de Escopo
Avalie o consumo de horas de cada disciplina. Atribua o desvio encontrado ao fator de **80% de trabalho fora do escopo**. Destaque o impacto financeiro e operacional dessa variação.

3. Avaliação do Dimensionamento Contratual (NOVO)
Analise se o número de horas e a equipe contratada originalmente foram ideais. Identifique se o projeto nasceu subdimensionado ou se os desvios são puramente por solicitações extras.

4. Projeção do H/H Ideal e Sugestão de Aditivo
Com base no Avanço Físico atual (${avgExec.toFixed(2)}%), estime o limite "ideal" de horas para o escopo original. Em seguida, **calcule e sugira explicitamente o volume de horas adicionais que deve ser cobrado em uma proposta de aditivo** para cobrir os 80% de desvios por extra-escopo.

5. Sugestões e Plano de Ação
Liste de 3 a 4 recomendações práticas para regularizar o contrato e para manter o bom desempenho técnico.

Diretrizes de Estilo:
Seja analítico, direto e profissional. Use negrito para destacar números, alertas e a sugestão de cobrança adicional.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { temperature: 0.4 }
    });
    return response.text || "Relatório de auditoria indisponível.";
  } catch (error) {
    console.error(error);
    return "Erro ao gerar relatório de auditoria sênior. Verifique se a API Key está correta.";
  }
};

export const generateLessonsLearnedReport = async (projects: DetailedProject[]): Promise<string> => {
  const ai = getAI();
  if (!ai) return "Erro: API Key não configurada.";

  const projectsData = projects.map(p => {
    const soldTotal = (p.soldHours?.infra || 0) + (p.soldHours?.sse || 0) + (p.soldHours?.ti || 0) + (p.soldHours?.aut || 0);
    const usedTotal = (p.usedHours?.infra || 0) + (p.usedHours?.sse || 0) + (p.usedHours?.ti || 0) + (p.usedHours?.aut || 0);
    const avgExec = p.steps && p.steps.length > 0 ? p.steps.reduce((acc, s) => acc + s.perc, 0) / p.steps.length : 0;
    
    return `
    Projeto: ${p.name}
    CC: ${p.costCenter}
    Período: ${p.start} a ${p.end}
    Execução Média: ${avgExec.toFixed(2)}%
    H/H Vendidas: ${soldTotal}h
    H/H Utilizadas: ${usedTotal}h
    Valor Vendido: ${p.totalSoldValue || 0}
    Valor Custo: ${p.totalCostValue || 0}
    Valor Utilizado: ${p.totalUsedValue || 0}
    Observações: ${p.observations || 'N/A'}
    `;
  }).join('\n---\n');

  const prompt = `Você é um Consultor de Gestão de Projetos e Especialista em Melhoria Contínua (Lean Six Sigma).
  Sua tarefa é analisar um conjunto de projetos FINALIZADOS da Teleinfo e gerar um Relatório de Lições Aprendidas Consolidado seguindo EXATAMENTE a estrutura abaixo.

  Objetivo da Análise:
  1. Avaliar a precisão das estimativas iniciais (Tempo, Horas e Valores).
  2. Identificar padrões de desvios (onde estamos errando mais?).
  3. Propor melhorias no processo de orçamentação e planejamento.
  4. Gerar insights para futuros projetos similares.

  Dados dos Projetos Selecionados:
  ${projectsData}

  Estrutura OBRIGATÓRIA do Relatório (Markdown):
  
  Como Consultor de Gestão de Projetos e Especialista Lean Six Sigma, realizei a análise técnica do(s) projeto(s) selecionado(s). Embora o portfólio atual conte com uma amostra específica, os dados fornecidos são ricos em indicadores de falhas de processo e gestão de riscos operacionais.
  Abaixo, apresento o Relatório Consolidado de Lições Aprendidas.

  # Relatório Consolidado de Lições Aprendidas - Nexus Intelligence
  
  ## 1. Resumo do Portfólio Analisado
  O projeto analisado apresenta um cenário de [DESCREVER CENÁRIO BASEADO NOS DADOS].
  - **Status de Execução:** [X]% concluído.
  - **Eficiência de Mão de Obra:** Utilização de [X]% das horas vendidas ([X]h de [X]h).
  - **Desempenho Global:** [DESCREVER DESEMPENHO GERAL].

  ## 2. Análise de Estimativas vs. Realidade
  - **Tempo/Cronograma:** [ANÁLISE DE ADERÊNCIA AO CRONOGRAMA].
  - **Recursos (H/H):** [ANÁLISE DE SUPERESTIMATIVA OU SUBDIMENSIONAMENTO].
  - **Financeiro:** [ANÁLISE DE MARGEM E CUSTOS DE NÃO-QUALIDADE].

  ## 3. Padrões Identificados e Causas Raiz
  A análise através da técnica dos "5 Porquês" e do Diagrama de Ishikawa aponta para os seguintes padrões:
  1. [PADRÃO 1]: [DESCRIÇÃO].
     - **Causa Raiz:** [CAUSA].
  2. [PADRÃO 2]: [DESCRIÇÃO].
     - **Causa Raiz:** [CAUSA].

  ## 4. Lições Aprendidas e Recomendações de Ouro
  Para os próximos orçamentos e planejamentos, as seguintes diretrizes devem ser institucionalizadas:
  - **[DIRETRIZ 1]:** [DESCRIÇÃO DETALHADA].
  - **[DIRETRIZ 2]:** [DESCRIÇÃO DETALHADA].
  - **[DIRETRIZ 3]:** [DESCRIÇÃO DETALHADA].

  ## 5. Conclusão Estratégica
  [PARECER FINAL PARA A DIRETORIA SOBRE MATURIDADE E EVOLUÇÃO].

  **Parecer Final:** [FRASE DE IMPACTO RESUMINDO O RESULTADO E ALERTA CRÍTICO].

  Responda em Português do Brasil, de forma técnica, executiva e propositiva.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { temperature: 0.4 }
    });
    return response.text || "Relatório de lições aprendidas indisponível.";
  } catch (error) {
    console.error(error);
    return "Erro ao gerar relatório de lições aprendidas.";
  }
};
