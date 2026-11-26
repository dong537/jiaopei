import pytest

from edu_collector.cli import main


def test_inspect_empty_directory_is_truly_read_only(tmp_path, capsys):
    target = tmp_path / "not-created"
    assert main(["inspect", "--data-dir", str(target)]) == 0
    assert not target.exists()
    assert "no ledger" in capsys.readouterr().out


def test_detail_command_does_not_invent_an_endpoint(tmp_path, capsys):
    assert main(["fetch-detail", "--data-dir", str(tmp_path), "--max-pages", "1", "--max-ids", "5", "--max-requests", "1"]) == 2
    assert "no confirmed public detail" in capsys.readouterr().err
    assert not (tmp_path / "ledger.sqlite3").exists()


def test_network_command_requires_limits_and_research_ack(tmp_path):
    with pytest.raises(SystemExit):
        main(["fetch-list", "--data-dir", str(tmp_path)])
    with pytest.raises(SystemExit):
        main(["fetch-list", "--data-dir", str(tmp_path), "--max-pages", "1", "--max-ids", "5", "--max-requests", "1"])
    assert not (tmp_path / "ledger.sqlite3").exists()


def test_zero_budget_is_rejected_before_network(tmp_path):
    with pytest.raises(SystemExit):
        main(["fetch-list", "--data-dir", str(tmp_path), "--max-pages", "1", "--max-ids", "5", "--max-requests", "0", "--ack-internal-research"])
    assert not (tmp_path / "ledger.sqlite3").exists()


def test_network_rejects_other_data_directory_and_multi_page_budget(tmp_path, capsys):
    common = ["--max-ids", "100", "--max-requests", "1", "--ack-internal-research"]
    assert main(["fetch-list", "--data-dir", str(tmp_path), "--max-pages", "1", *common]) == 2
    assert "site ledger" in capsys.readouterr().err
    assert not (tmp_path / "ledger.sqlite3").exists()
    assert main(["fetch-list", "--max-pages", "2", *common]) == 2
    assert "max-pages" in capsys.readouterr().err


def test_jinan_research_command_rejects_noncanonical_or_multi_request(tmp_path, capsys):
    base = ["--max-pages", "1", "--max-ids", "150", "--max-requests", "1", "--ack-internal-research"]
    assert main(["fetch-jinan", "--data-dir", str(tmp_path), *base]) == 2
    assert "site ledger" in capsys.readouterr().err
    assert not (tmp_path / "ledger.sqlite3").exists()
    bad = ["--max-pages", "1", "--max-ids", "150", "--max-requests", "2", "--ack-internal-research"]
    assert main(["fetch-jinan", *bad]) == 2
    assert "both limits must be 1" in capsys.readouterr().err
