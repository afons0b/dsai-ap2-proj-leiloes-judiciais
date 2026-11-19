import type { Checklist, Relatorio } from '@/api/types'

export const CHECKLIST_EXEMPLO: Checklist = {
  vara: 'Vara de Demonstração',
  numero_processo: 'PROCESSO-SINTETICO-001',
  juiz: 'Juiz Exemplo',
  tipo_justica: 'estadual',
  exequente: {
    nome: 'Exequente Exemplo',
    cpf_cnpj: null,
    advogados: [
      {
        nome: 'Advogado Exemplo',
        oab: 'OAB/EX DEMO',
        ref: 'Doc Sintético A'
      }
    ]
  },
  executados: [
    {
      nome: 'Executado Exemplo',
      cpf_cnpj: null,
      advogados: [
        {
          nome: 'Advogado Exemplo',
          oab: 'OAB/EX DEMO',
          ref: 'Doc Sintético A'
        }
      ],
      citado: true,
      citacao_forma: 'Forma registrada no exemplo',
      citacao_ref: 'Doc Sintético B'
    }
  ],
  execucao: {
    cda: null,
    natureza_divida: null,
    classe: 'Execução sintética',
    valor_divida: '500.00',
    data_divida: '2026-11-01'
  },
  bens: [
    {
      descricao: 'Bem sintético 1',
      matricula: 'MAT-SINTETICA-1',
      localizacao: null,
      data_penhora: null,
      penhora_ref: null,
      fiel_depositario: null,
      executado_intimado: true,
      data_intimacao: null,
      intimacao_ref: null,
      propriedade: null,
      valor_avaliacao: '100.00',
      data_avaliacao: null,
      oficial_avaliacao: null,
      valor_reavaliacao: null,
      data_reavaliacao: null,
      certidao_matricula_ref: null,
      averbacao_penhora: null,
      hipoteca: null,
      enfiteuse: null,
      outras_penhoras: null
    },
    {
      descricao: 'Bem sintético 2',
      matricula: 'MAT-SINTETICA-2',
      localizacao: null,
      data_penhora: null,
      penhora_ref: null,
      fiel_depositario: null,
      executado_intimado: true,
      data_intimacao: null,
      intimacao_ref: null,
      propriedade: null,
      valor_avaliacao: '200.00',
      data_avaliacao: null,
      oficial_avaliacao: null,
      valor_reavaliacao: null,
      data_reavaliacao: null,
      certidao_matricula_ref: null,
      averbacao_penhora: null,
      hipoteca: null,
      enfiteuse: null,
      outras_penhoras: null
    }
  ],
  recursos: null,
  observacoes_leilao: [
    'Observação sintética para demonstração.'
  ]
}

export const CHECKLIST_ESPECIALIZADO: Checklist = {
  ...CHECKLIST_EXEMPLO,
  exequente: {
    ...CHECKLIST_EXEMPLO.exequente,
    representacao: null,
    procuracao_ref: null,
    advogados: [{ nome: 'Advogado Exemplo', cpf: '00000000001', oab: 'OAB/EX DEMO', ref: 'Doc Sintético A' }],
  },
  bens: [
    { ...CHECKLIST_EXEMPLO.bens[0]!, categoria: 'imovel', imovel: { intimacao_conjuge: null, data_averbacao_penhora: null } },
    { ...CHECKLIST_EXEMPLO.bens[1]!, categoria: 'material', matricula: null },
    { ...CHECKLIST_EXEMPLO.bens[1]!, descricao: 'Veículo sintético', categoria: 'veiculo', matricula: null, veiculo: { renavam: '00012345678' } },
  ],
}

export const RELATORIO_EXEMPLO: Relatorio = {
  resumo: 'Relatório sintético de demonstração sem dados reais.',
  etapas: [
    {
      data: '2026-11-01',
      descricao: 'Etapa sintética 1',
      ref: 'Doc Sintético 1'
    },
    {
      data: '2026-11-02',
      descricao: 'Etapa sintética 2',
      ref: 'Doc Sintético 2'
    },
    {
      data: '2026-11-03',
      descricao: 'Etapa sintética 3',
      ref: 'Doc Sintético 3'
    },
    {
      data: '2026-11-04',
      descricao: 'Etapa sintética 4',
      ref: 'Doc Sintético 4'
    }
  ]
}
