def comma_format(value):
    try:
        return "{:,}".format(int(value))
    except (ValueError, TypeError):
        return value


def persian_digits(value):
    try:
        return str(int(value)).translate(str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹"))
    except (ValueError, TypeError):
        return value


def fa_to_en(text: str) -> str:
    return text.translate(str.maketrans("۰۱۲۳۴۵۶۷۸۹", "0123456789"))