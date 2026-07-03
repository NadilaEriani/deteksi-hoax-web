import torch
import torch.nn as nn
from torch.nn.utils.rnn import pack_padded_sequence


class LSTMHoaxClassifier(nn.Module):
    def __init__(
        self,
        bert_model,
        bert_hidden=768,
        lstm_hidden=256,
        num_layers=2,
        num_classes=2,
        dropout=0.3,
        bidirectional=True
    ):
        super(LSTMHoaxClassifier, self).__init__()

        self.bert = bert_model
        self.bidirectional = bidirectional

        for param in self.bert.parameters():
            param.requires_grad = False

        self.lstm = nn.LSTM(
            input_size=bert_hidden,
            hidden_size=lstm_hidden,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0,
            bidirectional=bidirectional
        )

        self.dropout = nn.Dropout(dropout)

        fc_input = lstm_hidden * 2 if bidirectional else lstm_hidden
        self.fc = nn.Linear(fc_input, num_classes)

    def forward(self, input_ids, attention_mask):
        self.bert.eval()

        with torch.no_grad():
            bert_out = self.bert(
                input_ids=input_ids,
                attention_mask=attention_mask
            )

        x = bert_out.last_hidden_state

        lengths = attention_mask.sum(dim=1).detach().cpu()
        lengths = torch.clamp(lengths, min=1)

        packed_x = pack_padded_sequence(
            x,
            lengths,
            batch_first=True,
            enforce_sorted=False
        )

        _, (hidden, _) = self.lstm(packed_x)

        if self.bidirectional:
            hidden = torch.cat([hidden[-2], hidden[-1]], dim=1)
        else:
            hidden = hidden[-1]

        hidden = self.dropout(hidden)
        out = self.fc(hidden)

        return out