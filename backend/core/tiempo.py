from datetime import timezone

def a_utc(momento):
    # Los datetimes naive (query params, body JSON) se asumen UTC para poder
    # compararlos contra now(timezone.utc).
    if momento is not None and momento.tzinfo is None:
        return momento.replace(tzinfo=timezone.utc)
    return momento
