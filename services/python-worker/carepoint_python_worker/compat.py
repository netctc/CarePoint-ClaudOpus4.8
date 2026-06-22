from __future__ import annotations

from typing import Any, TypeVar

from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


def model_validate(model: type[T], value: Any) -> T:
    validator = getattr(model, "model_validate", None)
    if callable(validator):
        return validator(value)
    return model.parse_obj(value)


def model_dump(model: BaseModel, *, by_alias: bool = False, mode: str | None = None) -> dict[str, Any]:
    dumper = getattr(model, "model_dump", None)
    if callable(dumper):
        kwargs: dict[str, Any] = {"by_alias": by_alias}
        if mode is not None:
            kwargs["mode"] = mode
        return dumper(**kwargs)
    return model.dict(by_alias=by_alias)
