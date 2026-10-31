#!/usr/bin/env python3
"""Self-check of the `tc -s class show` parser behind the ef_class_* / be_class_* columns.
Run:  .venv/bin/python tests/test_htb_parse.py   (prints 'ok'; an AssertionError means the columns would be wrong).
The sample is real OVS linux-htb output from the lab (eth5), with the EF class line edited to carry non-zero counters
and a 'Kb' backlog, the two shapes the regex must get right."""
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
from qos_sweep import parse_htb_class

SAMPLE = """class htb 1:1 parent 1:fffe prio 0 rate 1Mbit ceil 30Mbit burst 9564b cburst 9564b
 Sent 2072 bytes 30 pkt (dropped 0, overlimits 0 requeues 0) 
 backlog 0b 0p requeues 0
 lended: 30 borrowed: 0 giants: 0
 tokens: 1186750 ctokens: 39558

class htb 1:fffe root rate 30Mbit ceil 30Mbit burst 9499b cburst 9499b
 Sent 2072 bytes 30 pkt (dropped 0, overlimits 0 requeues 0) 
 backlog 0b 0p requeues 0
 lended: 0 borrowed: 0 giants: 0
 tokens: 39291 ctokens: 39291

class htb 1:2 parent 1:fffe prio 0 rate 20Mbit ceil 30Mbit burst 9564b cburst 9564b
 Sent 70839364 bytes 357773 pkt (dropped 4171, overlimits 751 requeues 0) 
 backlog 203Kb 1066p requeues 0
 lended: 0 borrowed: 0 giants: 0
 tokens: 59775 ctokens: 39850
"""

ef = parse_htb_class(SAMPLE, "1:2")
assert ef == {"rate_mbps": 20.0, "ceil_mbps": 30.0, "bytes": 70839364, "pkts": 357773,
              "drops": 4171, "overlimits": 751, "backlog_b": 203 * 1024, "backlog_p": 1066}, ef
be = parse_htb_class(SAMPLE, "1:1")                      # "1:1 " must not pick "1:fffe" or "1:2"
assert (be["rate_mbps"], be["ceil_mbps"], be["pkts"], be["drops"], be["backlog_p"]) == (1.0, 30.0, 30, 0, 0), be
assert parse_htb_class(SAMPLE, "1:20") is None           # absent class: None, never a neighbour's numbers
print("ok")
